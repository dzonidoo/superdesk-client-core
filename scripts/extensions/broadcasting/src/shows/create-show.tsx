import * as React from 'react';
import {Input, Button, Spinner, DurationInput} from 'superdesk-ui-framework/react';
import {CreateValidators, showModal, WithValidation} from '@superdesk/common';
import {CreateShowAfterModal} from './create-show-after-modal';
import {stringNotEmpty} from '../form-validation';
import {superdesk} from '../superdesk';
import {IShow, IShowBase} from '../interfaces';

const {gettext} = superdesk.localization;
const {Spacer} = superdesk.components;
const {httpRequestJsonLocal} = superdesk;

const {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} = superdesk.components;

interface IProps {
    closeModal(): void;
}

interface IState {
    show: IShowBase;
    inProgress: boolean;
}

const showValidators: CreateValidators<Partial<IShowBase>> = {
    title: stringNotEmpty,
};

export class CreateShowModal extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            show: {
                title: '',
                description: '',
                planned_duration: 3600,
            },
            inProgress: false,
        };

        this.updateShowProperty = this.updateShowProperty.bind(this);
        this.cancel = this.cancel.bind(this);
        this.doSave = this.doSave.bind(this);
    }

    private updateShowProperty(update: Partial<IShow>) {
        this.setState({
            ...this.state,
            show: {
                ...this.state.show,
                ...update,
            },
        });
    }

    private cancel() {
        this.props.closeModal();
    }

    private doSave() {
        this.setState({inProgress: true});

        httpRequestJsonLocal<IShow>({
            method: 'POST',
            path: '/shows',
            payload: this.state.show,
        }).then((show) => {
            this.setState({inProgress: false}, () => {
                this.props.closeModal();

                showModal(({closeModal}) => (
                    <CreateShowAfterModal
                        closeModal={closeModal}
                        show={show}
                    />
                ));
            });
        });
    }

    render() {
        const {show} = this.state;

        return (
            <WithValidation validators={showValidators}>
                {(validate, validationResults) => (
                    <Modal>
                        <ModalHeader onClose={this.props.closeModal}>
                            {gettext('Create new show')}
                        </ModalHeader>

                        <ModalBody>
                            <Spacer v gap="16">
                                <Input
                                    label={gettext('Show name')}
                                    type="text"
                                    value={show.title}
                                    error={validationResults.title ?? undefined}
                                    invalid={validationResults.title != null}
                                    required={true}
                                    onChange={(val) => {
                                        this.updateShowProperty({title: val});
                                    }}
                                />

                                <Input
                                    label={gettext('Description')}
                                    type="text"
                                    value={show.description}
                                    error={validationResults.description ?? undefined}
                                    invalid={validationResults.description != null}
                                    required={true}
                                    onChange={(val) => {
                                        this.updateShowProperty({description: val});
                                    }}
                                />

                                <DurationInput
                                    label={gettext('Planned duration')}
                                    seconds={show.planned_duration ?? 0}
                                    onChange={(val) => {
                                        this.updateShowProperty({planned_duration: val});
                                    }}
                                    error={validationResults.planned_duration ?? undefined}
                                    invalid={validationResults.planned_duration != null}
                                />
                            </Spacer>
                        </ModalBody>

                        <ModalFooter flex>
                            <Spacer h gap="32" justifyContent="space-between" noWrap>
                                <div>
                                    {
                                        this.state.inProgress && (
                                            <Spinner />
                                        )
                                    }
                                </div>

                                <div>
                                    <Spacer h gap="8" noWrap>
                                        <Button
                                            text={gettext('Cancel')}
                                            onClick={this.cancel}
                                            disabled={this.state.inProgress}
                                        />
                                        <Button
                                            text={gettext('Save')}
                                            onClick={() => {
                                                const valid = validate(show);

                                                if (valid) {
                                                    this.doSave();
                                                }
                                            }}
                                            type="primary"
                                            disabled={this.state.inProgress}
                                        />
                                    </Spacer>
                                </div>
                            </Spacer>
                        </ModalFooter>
                    </Modal>
                )}
            </WithValidation>
        );
    }
}
