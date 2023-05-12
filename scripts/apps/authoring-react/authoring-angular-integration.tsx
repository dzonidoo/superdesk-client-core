/* eslint-disable react/display-name */
/* eslint-disable react/no-multi-comp */
import {assertNever} from 'core/helpers/typescript-helpers';
import {DeskAndStage} from './subcomponents/desk-and-stage';
import {LockInfo} from './subcomponents/lock-info';
import {Button, ButtonGroup, IconButton, NavButton, Popover} from 'superdesk-ui-framework/react';
import {
    IArticle,
    ITopBarWidget,
    IExposedFromAuthoring,
    IAuthoringOptions,
} from 'superdesk-api';
import {appConfig, extensions} from 'appConfig';
import {ITEM_STATE} from 'apps/archive/constants';
import React from 'react';
import {gettext} from 'core/utils';
import {sdApi} from 'api';
import ng from 'core/services/ng';
import {AuthoringIntegrationWrapper} from './authoring-integration-wrapper';
import {MarkedDesks} from './toolbar/mark-for-desks/mark-for-desks-popover';
import {WithPopover} from 'core/helpers/with-popover';
import {HighlightsCardContent} from './toolbar/highlights-management';
import {authoringStorageIArticle} from './data-layer';
import {
    IStateInteractiveActionsPanelHOC,
    IActionsInteractiveActionsPanelHOC,
} from 'core/interactive-article-actions-panel/index-hoc';
import {IArticleActionInteractive} from 'core/interactive-article-actions-panel/interfaces';
import {dispatchInternalEvent} from 'core/internal-events';
import {notify} from 'core/notify/notify';

export interface IProps {
    itemId: IArticle['_id'];
}

function onClose() {
    ng.get('authoringWorkspace').close();
    ng.get('$rootScope').$applyAsync();
}

function getInlineToolbarActions(options: IExposedFromAuthoring<IArticle>): IAuthoringOptions<IArticle> {
    const {
        item,
        hasUnsavedChanges,
        handleUnsavedChanges,
        save,
        initiateClosing,
        keepChangesAndClose,
        stealLock,
    } = options;
    const itemState: ITEM_STATE = item.state;

    const saveButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.2,
        component: () => (
            <Button
                text={gettext('Save')}
                style="filled"
                type="primary"
                disabled={!hasUnsavedChanges()}
                onClick={() => {
                    save();
                }}
            />
        ),
        availableOffline: true,
        keyBindings: {
            'ctrl+shift+s': () => {
                if (hasUnsavedChanges()) {
                    save();
                }
            },
        },
    };

    const closeButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.1,
        component: () => (
            <Button
                text={gettext('Close')}
                style="hollow"
                onClick={() => {
                    initiateClosing();
                }}
            />
        ),
        availableOffline: true,
        keyBindings: {
            'ctrl+shift+e': () => {
                initiateClosing();
            },
        },
    };

    const minimizeButton: ITopBarWidget<IArticle> = {
        group: 'end',
        priority: 0.3,
        component: () => (
            <NavButton
                text={gettext('Minimize')}
                onClick={() => {
                    keepChangesAndClose();
                }}
                icon="minimize"
                iconSize="big"
            />
        ),
        availableOffline: true,
    };

    const getManageHighlights = (): ITopBarWidget<IArticle> => ({
        group: 'start',
        priority: 0.3,
        component: () => (
            <WithPopover
                component={({closePopup}) => (
                    <HighlightsCardContent
                        close={closePopup}
                        article={item}
                    />
                )}
                placement="right-end"
                zIndex={1050}
            >
                {
                    (togglePopup) => (
                        <IconButton
                            onClick={(event) =>
                                togglePopup(event.target as HTMLElement)
                            }
                            icon={
                                item.highlights.length > 1
                                    ? 'multi-star'
                                    : 'star'
                            }
                            ariaValue={gettext('Highlights')}
                        />
                    )
                }
            </WithPopover>
        ),
        availableOffline: true,
    });

    switch (itemState) {
    case ITEM_STATE.DRAFT:
        return {
            readOnly: false,
            actions: [saveButton, minimizeButton],
        };

    case ITEM_STATE.SUBMITTED:
    case ITEM_STATE.IN_PROGRESS:
    case ITEM_STATE.ROUTED:
    case ITEM_STATE.FETCHED:
    case ITEM_STATE.UNPUBLISHED:
        // eslint-disable-next-line no-case-declarations
        const actions: Array<ITopBarWidget<IArticle>> = [
            minimizeButton,
            closeButton,
        ];

        if (item.highlights != null) {
            actions.push(getManageHighlights());
        }

        // eslint-disable-next-line no-case-declarations
        const manageDesksButton: ITopBarWidget<IArticle> = ({
            group: 'start',
            priority: 0.3,
            // eslint-disable-next-line react/display-name
            component: () => (
                <>
                    <Popover
                        zIndex={1050}
                        triggerSelector="#marked-for-desks"
                        title={gettext('Marked for')}
                        placement="bottom-end"
                    >
                        <MarkedDesks
                            article={item}
                        />
                    </Popover>
                    <NavButton
                        onClick={() => null}
                        id="marked-for-desks"
                        icon="bell"
                        iconSize="small"
                    />
                </>
            ),
            availableOffline: true,
        });

        if (item.marked_desks?.length > 0) {
            actions.push(manageDesksButton);
        }

        actions.push({
            group: 'start',
            priority: 0.2,
            component: ({entity}) => <DeskAndStage article={entity} />,
            availableOffline: false,
        });

        if (sdApi.article.showPublishAndContinue(item, hasUnsavedChanges())) {
            actions.push({
                group: 'middle',
                priority: 0.3,
                component: ({entity}) => (
                    <Button
                        type="highlight"
                        onClick={() => {
                            const getLatestItem = hasUnsavedChanges()
                                ? handleUnsavedChanges()
                                : Promise.resolve(entity);

                            getLatestItem.then((article) => {
                                sdApi.article.publishItem(article, article).then((result) => {
                                    typeof result !== 'boolean'
                                        ? ng.get('authoring').rewrite(result)
                                        : notify.error(gettext('Failed to publish and continue.'));
                                });
                            });
                        }}
                        text={gettext('P & C')}
                        style="filled"
                    />
                ),
                availableOffline: false,
            });
        }

        if (sdApi.article.showCloseAndContinue(item, hasUnsavedChanges())) {
            actions.push({
                group: 'middle',
                priority: 0.4,
                component: ({entity}) => (
                    <Button
                        type="highlight"
                        onClick={() => {
                            const getLatestItem = hasUnsavedChanges()
                                ? handleUnsavedChanges()
                                : Promise.resolve(entity);

                            getLatestItem.then((article) => {
                                ng.get('authoring').close().then(() => {
                                    sdApi.article.rewrite(article);
                                });
                            });
                        }}
                        text={gettext('C & C')}
                        style="filled"
                    />
                ),
                availableOffline: false,
            });
        }

        // FINISH: ensure locking is available in generic version of authoring
        actions.push({
            group: 'start',
            priority: 0.1,
            component: ({entity}) => (
                <LockInfo
                    article={entity}
                    unlock={() => {
                        stealLock();
                    }}
                    isLockedInOtherSession={(article) => sdApi.article.isLockedInOtherSession(article)}
                />
            ),
            keyBindings: {
                'ctrl+shift+u': () => {
                    if (sdApi.article.isLockedInOtherSession(item)) {
                        stealLock();
                    }
                },
            },
            availableOffline: false,
        });

        if (sdApi.article.isLockedInCurrentSession(item)) {
            actions.push(saveButton);
        }

        if (
            sdApi.article.isLockedInCurrentSession(item)
            && appConfig.features.customAuthoringTopbar.toDesk === true
            && sdApi.article.isPersonal(item) !== true
        ) {
            actions.push({
                group: 'middle',
                priority: 0.2,
                component: () => (
                    <Button
                        text={gettext('TD')}
                        style="filled"
                        onClick={() => {
                            handleUnsavedChanges()
                                .then(() => sdApi.article.sendItemToNextStage(item))
                                .then(() => initiateClosing());
                        }}
                    />
                ),
                availableOffline: false,
            });
        }

        return {
            readOnly: sdApi.article.isLockedInCurrentSession(item) !== true,
            actions: actions,
        };

    case ITEM_STATE.INGESTED:
        return {
            readOnly: true,
            actions: [], // fetch
        };

    case ITEM_STATE.SPIKED:
        return {
            readOnly: true,
            actions: [], // un-spike
        };

    case ITEM_STATE.SCHEDULED:
        return {
            readOnly: true,
            actions: [], // un-schedule
        };

    case ITEM_STATE.PUBLISHED:
    case ITEM_STATE.CORRECTED:
        return {
            readOnly: true,
            actions: [], // correct update kill takedown
        };

    case ITEM_STATE.BEING_CORRECTED:
        return {
            readOnly: true,
            actions: [], // cancel correction
        };

    case ITEM_STATE.CORRECTION:
        return {
            readOnly: false,
            actions: [], // cancel correction, save, publish
        };

    case ITEM_STATE.KILLED:
    case ITEM_STATE.RECALLED:
        return {
            readOnly: true,
            actions: [], // NONE
        };
    default:
        assertNever(itemState);
    }
}

function getPublishToolbarWidget(
    panelState: IStateInteractiveActionsPanelHOC,
    panelActions: IActionsInteractiveActionsPanelHOC,
): ITopBarWidget<IArticle> {
    const publishWidgetButton: ITopBarWidget<IArticle> = {
        priority: 99,
        availableOffline: false,
        group: 'end',
        // eslint-disable-next-line react/display-name
        component: (props: {entity: IArticle}) => (
            <ButtonGroup align="end">
                <ButtonGroup subgroup={true} spaces="no-space">
                    <NavButton
                        type="highlight"
                        icon="send-to"
                        iconSize="big"
                        text={gettext('Send to / Publish')}
                        onClick={() => {
                            if (panelState.active) {
                                panelActions.closePanel();
                            } else {
                                const availableTabs: Array<IArticleActionInteractive> = [
                                    'send_to',
                                ];

                                const canPublish =
                                    sdApi.article.canPublish(props.entity);

                                if (canPublish) {
                                    availableTabs.push('publish');
                                }

                                dispatchInternalEvent('interactiveArticleActionStart', {
                                    items: [props.entity],
                                    tabs: availableTabs,
                                    activeTab: canPublish ? 'publish' : availableTabs[0],
                                });
                            }
                        }}
                    />
                </ButtonGroup>
            </ButtonGroup>
        ),
    };

    return publishWidgetButton;
}

export function getAuthoringPrimaryToolbarWidgets(
    panelState: IStateInteractiveActionsPanelHOC,
    panelActions: IActionsInteractiveActionsPanelHOC,
) {
    return Object.values(extensions)
        .flatMap(({activationResult}) =>
                activationResult?.contributions?.authoringTopbarWidgets ?? [],
        )
        .map((item): ITopBarWidget<IArticle> => {
            const Component = item.component;

            return {
                ...item,
                component: (props: {entity: IArticle}) => (
                    <Component article={props.entity} />
                ),
            };
        })
        .concat([getPublishToolbarWidget(panelState, panelActions)]);
}

export class AuthoringAngularIntegration extends React.PureComponent<IProps> {
    render(): React.ReactNode {
        return (
            <div className="sd-authoring-react">
                <AuthoringIntegrationWrapper
                    sidebarMode={true}
                    getAuthoringPrimaryToolbarWidgets={getAuthoringPrimaryToolbarWidgets}
                    itemId={this.props.itemId}
                    onClose={onClose}
                    getInlineToolbarActions={getInlineToolbarActions}
                    authoringStorage={authoringStorageIArticle}
                />
            </div>
        );
    }
}
