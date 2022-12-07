import {httpRequestJsonLocal} from 'core/helpers/network';
import {Spacer} from 'core/ui/components/Spacer';
import {gettext} from 'core/utils';
import React from 'react';
import {IArticle} from 'superdesk-api';
import {Modal, Select, Switch, Option, Button} from 'superdesk-ui-framework/react';

interface IProps {
    closeModal(): void;
    article: IArticle;
}

interface IStateLoading {
    initialized: false;
}

interface IStateLoaded {
    initialized: true;
    validate: boolean;
    selectedFormatter: string | null;
    availableFormatters: Array<any> | null;
}

type IState = IStateLoaded | IStateLoading;

export default class ExportModal extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            initialized: false,
        };
    }

    componentDidMount(): void {
        this.fetchFormatters().then((result: any) => {
            this.setState({
                ...this.state,
                initialized: true,
                availableFormatters: result._items,
            });
        });
    }

    fetchFormatters() {
        return httpRequestJsonLocal({
            method: 'GET',
            path: '/formatters',
            urlParams: {
                criteria: 'can_export',
            },
        });
    }

    exportArticle() {
        if (this.state.initialized) {
            return httpRequestJsonLocal({
                method: 'POST',
                path: '/export',
                payload: {
                    item_ids: [this.props.article._id],
                    validate: this.state.validate,
                    format_type: this.state.selectedFormatter,
                },
            }).then((response: any) => {
                return window.open(response.url);
            });
        }
    }

    render(): JSX.Element {
        const state = this.state;

        if (!state.initialized) {
            return null;
        }

        return (
            <Modal
                size="medium"
                onHide={this.props.closeModal}
                visible
                zIndex={1050}
                headerTemplate={gettext('Export')}
            >
                <Spacer v gap="32">
                    <Select
                        value={state.selectedFormatter}
                        onChange={(value) => this.setState({...state, selectedFormatter: value})}
                        label={gettext('Formatters')}
                    >
                        <Option />
                        {
                            state.availableFormatters.map(({name}) => {
                                return (
                                    <Option
                                        key={name}
                                    >
                                        {name}
                                    </Option>
                                );
                            })
                        }
                    </Select>
                    <Switch
                        label={{text: gettext('Validate'), side: 'left'}}
                        value={state.validate}
                        onChange={(value) => this.setState({...state, validate: value})}
                    />
                    <Spacer h gap="8" justifyContent="end" noGrow>
                        <Button
                            onClick={() => this.exportArticle()}
                            type="primary"
                            text={gettext('Export')}
                        />
                        <Button
                            onClick={() => this.props.closeModal()}
                            type="default"
                            text={gettext('Cancel')}
                        />
                    </Spacer>
                </Spacer>
            </Modal>
        );
    }
}
