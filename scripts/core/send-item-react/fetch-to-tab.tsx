import React from 'react';
import {IArticle} from 'superdesk-api';
import {Button, ToggleBox} from 'superdesk-ui-framework/react';
import {gettext} from 'core/utils';
import {httpRequestJsonLocal} from 'core/helpers/network';
import {PanelContent} from './panel/panel-content';
import {PanelFooter} from './panel/panel-footer';
import {openArticle} from 'core/get-superdesk-api-implementation';
import {getInitialDestination} from './get-initial-destination';
import {DestinationSelect} from './destination-select';
import {ISendToDestination} from './interfaces';

interface IProps {
    items: Array<IArticle>;
    closeFetchToView(): void;
    markupV2: boolean;
    handleUnsavedChanges(items: Array<IArticle>): Promise<Array<IArticle>>;
}

interface IState {
    selectedDestination: ISendToDestination;
}

export class FetchToTab extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        const selectedDestination = getInitialDestination(props.items, false);

        this.state = {
            selectedDestination: selectedDestination,
        };

        this.fetchItems = this.fetchItems.bind(this);
    }

    fetchItems(openAfterFetching?: boolean) {
        const {selectedDestination} = this.state;
        const {items} = this.props;

        /**
         * Only desk selection is supported.
         */
        if (selectedDestination.type === 'desk') {
            Promise.all(
                items.map((item) => httpRequestJsonLocal<IArticle>({
                    method: 'POST',
                    path: `/ingest/${item._id}/fetch`,
                    payload: {
                        desk: selectedDestination.desk,
                        stage: selectedDestination.stage,
                    },
                })),
            ).then((res) => {
                this.props.closeFetchToView();

                if (openAfterFetching) {
                    openArticle(res[0]._id, 'edit');
                }
            });
        }
    }

    render() {
        const {markupV2} = this.props;

        return (
            <React.Fragment>
                <PanelContent markupV2={markupV2}>
                    <ToggleBox title={gettext('Destination')} initiallyOpen>
                        <DestinationSelect
                            value={this.state.selectedDestination}
                            onChange={(value) => {
                                this.setState({
                                    selectedDestination: value,
                                });
                            }}
                            includePersonalSpace={false}
                        />
                    </ToggleBox>
                </PanelContent>

                <PanelFooter markupV2={markupV2}>
                    {
                        this.props.items.length === 1 && (
                            <Button
                                text={gettext('Fetch and open')}
                                onClick={() => {
                                    this.fetchItems(true);
                                }}
                                size="large"
                                type="primary"
                                expand
                            />
                        )
                    }

                    <Button
                        text={gettext('Fetch')}
                        onClick={() => {
                            this.fetchItems();
                        }}
                        size="large"
                        type="primary"
                        expand
                    />
                </PanelFooter>
            </React.Fragment>
        );
    }
}