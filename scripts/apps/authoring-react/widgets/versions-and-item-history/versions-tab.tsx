import React from 'react';
import {
    IArticle,
    IExtensionActivationResult,
    IRestApiResponse,
    IDesk,
    IStage,
} from 'superdesk-api';
import {gettext, getItemLabel} from 'core/utils';
import {httpRequestJsonLocal} from 'core/helpers/network';
import {Card} from 'core/ui/components/Card';
import {TimeElem} from 'apps/search/components';
import {Spacer, SpacerBlock} from 'core/ui/components/Spacer';
import {store} from 'core/data';
import {StateComponent} from 'apps/search/components/fields/state';
import {Button, Checkbox} from 'superdesk-ui-framework/react';
import {notNullOrUndefined} from 'core/helpers/typescript-helpers';
import {Map} from 'immutable';
import {sdApi} from 'api';
import {dispatchInternalEvent} from 'core/internal-events';
import {omitFields} from '../../data-layer';
import {compareArticles} from '../../compare-articles/compare-articles';
import {previewArticle} from '../../preview-article-modal';
import {getArticleAdapter} from '../../article-adapter';

const loadingState: IState = {
    versions: 'loading',
    desks: Map(),
    stages: Map(),
    selectedForComparison: [],
};

type IProps = React.ComponentProps<
    IExtensionActivationResult['contributions']['authoringSideWidgets'][0]['component']
>;

interface IState {
    versions: Array<IArticle> | 'loading';
    desks: Map<string, IDesk>;
    stages: Map<string, IStage>;
    selectedForComparison: Array<IArticle>;
}

export class VersionsTab extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = loadingState;

        this.initialize = this.initialize.bind(this);
        this.revert = this.revert.bind(this);
        this.compareVersions = this.compareVersions.bind(this);
    }

    initialize() {
        Promise.all([
            httpRequestJsonLocal<IRestApiResponse<IArticle>>({
                method: 'GET',
                path: `/archive/${this.props.article._id}?version=all`,
            }),
            getArticleAdapter(),
        ]).then(([res, adapter]) => {
            const items = res._items.map((item) => adapter.toAuthoringReact(item));

            const deskIds = items.map((item) => item.task?.desk).filter(notNullOrUndefined);
            const stageIds = items.map((item) => item.task?.stage).filter(notNullOrUndefined);

            return Promise.all([
                httpRequestJsonLocal<IRestApiResponse<IDesk>>({
                    method: 'GET',
                    path: '/desks',
                    urlParams: {$in: deskIds}},
                ),
                httpRequestJsonLocal<IRestApiResponse<IStage>>({
                    method: 'GET',
                    path: '/stages',
                    urlParams: {$in: stageIds}},
                ),
            ]).then(([resDesks, resStages]) => {
                this.setState({
                    versions: items.reverse(),
                    desks: Map(resDesks._items.map((item) => [item._id, item])),
                    stages: Map(resStages._items.map((item) => [item._id, item])),
                });
            });
        });
    }

    revert(version: IArticle) {
        this.props.handleUnsavedChanges().then(({_id, _etag}) => {
            httpRequestJsonLocal<IArticle>({
                method: 'PATCH',
                path: `/archive/${_id}`,
                payload: omitFields(version, true),
                headers: {
                    'If-Match': _etag,
                },
            }).then(() => {
                dispatchInternalEvent('dangerouslyForceReloadAuthoring', undefined);

                this.setState(loadingState);

                this.initialize();
            });
        });
    }

    compareVersions() {
        const [item1, item2] = this.state.selectedForComparison;

        compareArticles(
            {
                label: gettext('version {{n}}', {n: item1._current_version}),
                article: item1,
            },
            {
                label: gettext('version {{n}}', {n: item2._current_version}),
                article: item2,
            },
        );

        this.setState({selectedForComparison: []});
    }

    componentDidMount() {
        this.initialize();
    }

    render() {
        if (this.state.versions === 'loading') {
            return null;
        }

        const {versions, desks, stages, selectedForComparison} = this.state;
        const {readOnly} = this.props;

        const userEntities =
            store.getState().entities.users;

        return (
            <Spacer v gap="8" noWrap alignItems="stretch">
                <Spacer h gap="8" justifyContent="space-between" noGrow>
                    <Spacer h gap="8" justifyContent="start" noGrow>
                        {gettext('Selected: {{n}}', {n: selectedForComparison.length})}

                        {
                            selectedForComparison.length > 0 && (
                                <Button
                                    text={gettext('Clear')}
                                    onClick={() => {
                                        this.setState({selectedForComparison: []});
                                    }}
                                    style="hollow"
                                    size="small"
                                />
                            )
                        }
                    </Spacer>

                    <Button
                        text={gettext('Compare')}
                        disabled={selectedForComparison.length !== 2}
                        onClick={() => {
                            this.compareVersions();
                        }}
                        type="primary"
                        size="small"
                    />
                </Spacer>

                {
                    versions.map((item, i) => {
                        const canRevert = i !== 0 && !readOnly && !sdApi.article.isPublished(item);

                        return (
                            <Card key={i}>
                                <Spacer h gap="8" justifyContent="space-between" noGrow>
                                    <TimeElem date={item._created} />
                                    <span>
                                        {
                                            gettext('by {{user}}', {
                                                user: userEntities[item.version_creator].display_name,
                                            })
                                        }
                                    </span>
                                </Spacer>

                                <SpacerBlock v gap="8" />

                                <div>
                                    <strong>{getItemLabel(item)}</strong>
                                </div>

                                <SpacerBlock v gap="8" />

                                {
                                    item.task.desk != null && (
                                        <Spacer h gap="8" justifyContent="space-between" noGrow>
                                            <span>{desks.get(item.task.desk).name}</span>
                                            <span>{stages.get(item.task.stage).name}</span>
                                        </Spacer>
                                    )
                                }

                                <SpacerBlock v gap="8" />

                                <Spacer h gap="8" justifyContent="space-between" alignItems="center" noWrap>
                                    <div>
                                        {gettext('version: {{n}}', {n: item._current_version})}
                                    </div>

                                    <div style={{display: 'flex'}}>
                                        <StateComponent item={item} />
                                    </div>
                                </Spacer>

                                <SpacerBlock v gap="8" />

                                <Spacer h gap="8" justifyContent="space-between" alignItems="center" noGrow>
                                    <div>
                                        <Checkbox
                                            label={{text: gettext('Select for comparison'), hidden: true}}
                                            checked={selectedForComparison.includes(item)}
                                            onChange={(val) => {
                                                if (val === true) {
                                                    this.setState({
                                                        selectedForComparison:
                                                            selectedForComparison.concat(item),
                                                    });
                                                } else {
                                                    this.setState({
                                                        selectedForComparison:
                                                            selectedForComparison.filter(
                                                                (_item) => _item !== item,
                                                            ),
                                                    });
                                                }
                                            }}
                                        />
                                    </div>

                                    <Spacer h gap="4" justifyContent="start" alignItems="center" noGrow>
                                        <div>
                                            <Button
                                                text={gettext('Preview')}
                                                onClick={() => {
                                                    previewArticle(
                                                        gettext('version {{n}}', {n: item._current_version}),
                                                        item,
                                                    );
                                                }}
                                                style="hollow"
                                                size="small"
                                            />
                                        </div>

                                        {
                                            canRevert && (
                                                <div>
                                                    <Button
                                                        text={gettext('Revert')}
                                                        onClick={() => {
                                                            this.revert(item);
                                                        }}
                                                        style="hollow"
                                                        size="small"
                                                    />
                                                </div>
                                            )
                                        }
                                    </Spacer>
                                </Spacer>
                            </Card>
                        );
                    })
                }
            </Spacer>
        );
    }
}