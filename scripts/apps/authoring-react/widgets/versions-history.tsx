import React from 'react';
import {
    IAuthoringSideWidget,
    IArticle,
    IExtensionActivationResult,
    IRestApiResponse,
    IDesk,
    IStage,
} from 'superdesk-api';
import {gettext, getItemLabel} from 'core/utils';
import {AuthoringWidgetHeading} from 'apps/dashboard/widget-heading';
import {AuthoringWidgetLayout} from 'apps/dashboard/widget-layout';
import {httpRequestJsonLocal} from 'core/helpers/network';
import {Card} from 'core/ui/components/Card';
import {TimeElem} from 'apps/search/components';
import {Spacer, SpacerInline} from 'core/ui/components/Spacer';
import {store} from 'core/data';
import {StateComponent} from 'apps/search/components/fields/state';
import {Button} from 'superdesk-ui-framework/react';
import {notNullOrUndefined} from 'core/helpers/typescript-helpers';
import {Map} from 'immutable';
import {sdApi} from 'api';
import {dispatchInternalEvent} from 'core/internal-events';
import {omitFields} from '../data-layer';

const loadingState: IState = {
    versions: 'loading',
    desks: Map(),
    stages: Map(),
};

// Can't call `gettext` in the top level
const getLabel = () => gettext('Versions and history');

type IProps = React.ComponentProps<
    IExtensionActivationResult['contributions']['authoringSideWidgets'][0]['component']
>;

interface IState {
    versions: Array<IArticle> | 'loading';
    desks: Map<string, IDesk>;
    stages: Map<string, IStage>;
}

class VersionsHistoryWidget extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = loadingState;

        this.revert = this.revert.bind(this);
        this.initialize = this.initialize.bind(this);
    }

    initialize() {
        httpRequestJsonLocal<IRestApiResponse<IArticle>>({
            method: 'GET',
            path: `/archive/${this.props.article._id}?version=all`,
        }).then((res) => {
            const items = res._items;

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
                    versions: res._items.reverse(),
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

    componentDidMount() {
        this.initialize();
    }

    render() {
        if (this.state.versions === 'loading') {
            return null;
        }

        const {versions, desks, stages} = this.state;
        const {readOnly} = this.props;

        const userEntities =
            store.getState().users.entities;

        return (
            <AuthoringWidgetLayout
                header={(
                    <AuthoringWidgetHeading
                        widgetName={getLabel()}
                        editMode={false}
                    />
                )}
                body={(
                    <Spacer v gap="8">
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

                                        <SpacerInline v gap="8" />

                                        <div>
                                            <strong>{getItemLabel(item)}</strong>
                                        </div>

                                        <SpacerInline v gap="8" />

                                        {
                                            item.task.desk != null && (
                                                <Spacer h gap="8" justifyContent="space-between" noGrow>
                                                    <span>{desks.get(item.task.desk).name}</span>
                                                    <span>{stages.get(item.task.stage).name}</span>
                                                </Spacer>
                                            )
                                        }

                                        <SpacerInline v gap="8" />

                                        <Spacer h gap="8" justifyContent="space-between" alignItems="center" noWrap>
                                            <Spacer h gap="8" justifyContent="start" alignItems="center" noWrap>
                                                <div>
                                                    {gettext('version: {{n}}', {n: item._current_version})}
                                                </div>

                                                <div style={{display: 'flex'}}>
                                                    <StateComponent item={item} />
                                                </div>
                                            </Spacer>

                                            {
                                                canRevert && (
                                                    <div>
                                                        <Button
                                                            text={gettext('revert')}
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
                                    </Card>
                                );
                            })
                        }
                    </Spacer>
                )}
                background="grey"
            />
        );
    }
}

export function getVersionsHistoryWidget() {
    const widget: IAuthoringSideWidget = {
        _id: 'versions-history',
        label: getLabel(),
        order: 4,
        icon: 'history',
        component: VersionsHistoryWidget,
    };

    return widget;
}
