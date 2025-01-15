/* eslint-disable react/no-multi-comp */
/* eslint-disable no-case-declarations */
/* eslint-disable react/display-name */
import React from 'react';
import {
    IArticle,
    IAuthoringAction,
    IArticleSideWidget,
    ITopBarWidget,
    IExposedFromAuthoring,
    IAuthoringStorage,
    IFieldsAdapter,
    IStorageAdapter,
    IRestApiResponse,
    IFieldsData,
} from 'superdesk-api';
import {AuthoringReact} from './authoring-react';
import {getFieldsAdapter} from './field-adapters';
import {dispatchCustomEvent} from 'core/get-superdesk-api-implementation';
import {extensions} from 'appConfig';
import {getAuthoringActionsFromExtensions} from 'core/superdesk-api-helpers';
import {gettext} from 'core/utils';
import {sdApi} from 'api';
import {
    IActionsInteractiveActionsPanelHOC,
    IStateInteractiveActionsPanelHOC,
    WithInteractiveArticleActionsPanel,
} from 'core/interactive-article-actions-panel/index-hoc';
import {InteractiveArticleActionsPanel} from 'core/interactive-article-actions-panel/index-ui';
import {CreatedModifiedInfo} from './subcomponents/created-modified-info';
import {ARTICLE_RELATED_RESOURCE_NAMES} from 'core/constants';
import {showModal} from '@superdesk/common';
import {ExportModal} from './toolbar/export-modal';
import {TranslateModal} from './toolbar/translate-modal';
import {HighlightsModal} from './toolbar/highlights-modal';
import {CompareArticleVersionsModal} from './toolbar/compare-article-versions';
import {httpRequestJsonLocal} from 'core/helpers/network';
import {getArticleAdapter} from './article-adapter';
import {ui} from 'core/ui-utils';
import {MultiEditToolbarAction} from './toolbar/multi-edit-toolbar-action';
import {MarkForDesksModal} from './toolbar/mark-for-desks/mark-for-desks-modal';
import {TemplateModal} from './toolbar/template-modal';
import {WidgetStatePersistenceHOC, widgetState} from './widget-persistance-hoc';
import {PINNED_WIDGET_USER_PREFERENCE_SETTINGS, closedIntentionally} from 'apps/authoring/widgets/widgets';
import {AuthoringIntegrationWrapperSidebar} from './authoring-integration-wrapper-sidebar';
import {assertNever} from 'core/helpers/typescript-helpers';
import {ContentProfileDropdown} from './subcomponents/content-profile-dropdown';
import {IconButton} from 'superdesk-ui-framework';

export function getWidgetsFromExtensions(article: IArticle): Array<IArticleSideWidget> {
    return Object.values(extensions)
        .flatMap((extension) => extension.activationResult?.contributions?.authoringSideWidgets ?? [])
        .filter((widget) => widget.isAllowed?.(article) ?? true)
        .sort((a, b) => a.order - b.order);
}

interface IProps {
    itemId: IArticle['_id'];
}

const getAuthoringCosmeticActions = (exposed: IExposedFromAuthoring<IArticle>): Array<ITopBarWidget<IArticle>> => [{
    availableOffline: true,
    component: () => (
        <IconButton
            icon="preview-mode"
            ariaValue={gettext('Print preview')}
            onClick={() => {
                exposed.printPreview();
            }}
        />
    ),
    group: 'end',
    priority: 1,
    keyBindings: {'ctrl+shift+i': () => {
        exposed.printPreview();
    }},
},
{
    availableOffline: true,
    component: () => (
        <IconButton
            icon="adjust"
            ariaValue={gettext('Toggle theme')}
            onClick={() => {
                exposed.toggleTheme();
            }}
        />
    ),
    group: 'end',
    priority: 2,
    keyBindings: {'ctrl+shift+t': () => {
        exposed.toggleTheme();
    }},
},
{
    availableOffline: true,
    component: () => (
        <IconButton
            icon="switches"
            ariaValue={gettext('Configure themes')}
            onClick={() => {
                exposed.configureTheme();
            }}
        />
    ),
    group: 'end',
    priority: 3,
    keyBindings: {'ctrl+shift+c': () => {
        exposed.configureTheme();
    }},
}];

export type ISideWidget = {
    activeId?: string;
    pinnedId?: string;
};

const getCompareVersionsModal = (
    getLatestItem: IExposedFromAuthoring<IArticle>['getLatestItem'],
    authoringStorage: IAuthoringStorage<IArticle>,
    fieldsAdapter: IFieldsAdapter<IArticle>,
    storageAdapter: IStorageAdapter<IArticle>,
): IAuthoringAction => ({
    label: gettext('Compare versions'),
    onTrigger: () => {
        const article = getLatestItem();

        Promise.all([
            httpRequestJsonLocal<IRestApiResponse<IArticle>>({
                method: 'GET',
                path: `/archive/${article._id}?version=all`,
            }),
            getArticleAdapter(),
        ]).then(([res, adapter]) => {
            const versions = res._items.map((item) => adapter.toAuthoringReact(item)).reverse();

            if (versions.length <= 1) {
                ui.alert(gettext('At least two versions are needed for comparison. This article has only one.'));
            } else {
                showModal(({closeModal}) => {
                    return (
                        <CompareArticleVersionsModal
                            closeModal={closeModal}
                            authoringStorage={authoringStorage}
                            fieldsAdapter={fieldsAdapter}
                            storageAdapter={storageAdapter}
                            versions={versions}
                            article={article}
                            getLanguage={() => article.language}
                        />
                    );
                });
            }
        });
    },
});

const getMultiEditModal = (getItem: IExposedFromAuthoring<IArticle>['getLatestItem']): IAuthoringAction => ({
    label: gettext('Multi-edit'),
    onTrigger: () => {
        showModal(({closeModal}) => (
            <MultiEditToolbarAction
                onClose={closeModal}
                initiallySelectedArticle={getItem()}
            />
        ));
    },
});

const getExportModal = (
    getLatestItem: IExposedFromAuthoring<IArticle>['getLatestItem'],
    handleUnsavedChanges: () => Promise<IArticle>,
    hasUnsavedChanges: () => boolean,
): IAuthoringAction => ({
    label: gettext('Export'),
    onTrigger: () => {
        const openModal = (article: IArticle) => showModal(({closeModal}) => {
            return (
                <ExportModal
                    closeModal={closeModal}
                    article={article}
                />
            );
        });

        if (hasUnsavedChanges()) {
            handleUnsavedChanges().then((article) => openModal(article));
        } else {
            openModal(getLatestItem());
        }
    },
});

const getHighlightsAction = (getItem: IExposedFromAuthoring<IArticle>['getLatestItem']): IAuthoringAction => {
    const showHighlightsModal = () => {
        sdApi.highlights.fetchHighlights().then((res) => {
            if (res._items.length === 0) {
                ui.alert(gettext('No highlights have been created yet.'));
            } else {
                showModal(({closeModal}) => (
                    <HighlightsModal
                        article={getItem()}
                        closeModal={closeModal}
                    />
                ));
            }
        });
    };

    return {
        label: gettext('Highlights'),
        onTrigger: () => showHighlightsModal(),
        keyBindings: {
            'ctrl+shift+h': () => {
                showHighlightsModal();
            },
        },
    };
};

const getSaveAsTemplate = (getItem: IExposedFromAuthoring<IArticle>['getLatestItem']): IAuthoringAction => ({
    label: gettext('Save as template'),
    onTrigger: () => (
        showModal(({closeModal}) => {
            return (
                <TemplateModal
                    closeModal={closeModal}
                    item={getItem()}
                />
            );
        })
    ),
});

const getTranslateModal = (getItem: IExposedFromAuthoring<IArticle>['getLatestItem']): IAuthoringAction => ({
    label: gettext('Translate'),
    onTrigger: () => {
        showModal(({closeModal}) => (
            <TranslateModal
                closeModal={closeModal}
                article={getItem()}
            />
        ));
    },
});

const getMarkedForDesksModal = (getItem: IExposedFromAuthoring<IArticle>['getLatestItem']): IAuthoringAction => ({
    label: gettext('Marked for desks'),
    onTrigger: () => (
        showModal(({closeModal}) => {
            return (
                <MarkForDesksModal
                    closeModal={closeModal}
                    article={getItem()}
                />
            );
        })
    ),
});

interface IPropsWrapper extends IProps {
    onClose?(): void;
    getAuthoringPrimaryToolbarWidgets?: (
        panelState: IStateInteractiveActionsPanelHOC,
        panelActions: IActionsInteractiveActionsPanelHOC,
    ) => Array<ITopBarWidget<IArticle>>;
    getInlineToolbarActions?(options: IExposedFromAuthoring<IArticle>): {
        readOnly: boolean;
        actions: Array<ITopBarWidget<IArticle>>;
    };

    // If it's not passed then the sidebar is shown expanded and can't be collapsed.
    // If hidden is passed then it can't be expanded.
    // If it's set to true or false then it can be collapsed/expanded back.
    sidebarMode?: boolean | 'hidden';
    authoringStorage: IAuthoringStorage<IArticle>;
    onFieldChange?(
        fieldId: string,
        fieldsData: IFieldsData,
        computeLatestEntity: IExposedFromAuthoring<IArticle>['getLatestItem'],
    ): IFieldsData;

    autoFocus?: boolean; // defaults to true
}

/**
 * The purpose of the wrapper is to handle integration with the angular part of the application.
 * The main component will not know about angular.
 */

interface IState {
    sidebarMode: boolean | 'hidden';
    sideWidget: ISideWidget;
}

export class AuthoringIntegrationWrapper extends React.PureComponent<IPropsWrapper, IState> {
    private authoringReactRef: AuthoringReact<IArticle> | null;

    constructor(props: IPropsWrapper) {
        super(props);

        const localStorageWidget = localStorage.getItem('SIDE_WIDGET');
        const widgetId = localStorageWidget != null ? JSON.parse(localStorageWidget) : null;

        this.state = {
            sidebarMode: this.props.sidebarMode === 'hidden' ? 'hidden' : (this.props.sidebarMode ?? false),
            sideWidget: {
                pinnedId: widgetId,
                activeId: widgetId,
            },
        };

        this.prepareForUnmounting = this.prepareForUnmounting.bind(this);
        this.handleUnsavedChanges = this.handleUnsavedChanges.bind(this);
        this.toggleSidebar = this.toggleSidebar.bind(this);
        this.loadWidgetFromPreferences = this.loadWidgetFromPreferences.bind(this);
    }

    componentDidMount(): void {
        this.loadWidgetFromPreferences();
    }

    componentDidUpdate(_prevProps: IPropsWrapper, prevState: IState): void {
        if (
            this.state.sideWidget?.pinnedId != null
            && this.state.sideWidget?.pinnedId != prevState.sideWidget?.pinnedId
        ) {
            this.loadWidgetFromPreferences();
        }
    }

    private loadWidgetFromPreferences() {
        const pinnedWidgetPreference = sdApi.preferences.get(PINNED_WIDGET_USER_PREFERENCE_SETTINGS);

        if (pinnedWidgetPreference?._id != null) {
            this.setState({
                sideWidget: {
                    pinnedId: pinnedWidgetPreference._id,
                    activeId: pinnedWidgetPreference._id,
                },
            });
        }
    }

    public toggleSidebar() {
        if (typeof this.state.sidebarMode === 'boolean') {
            this.setState({sidebarMode: !this.state.sidebarMode});
        }
    }

    public isSidebarCollapsed() {
        return this.state.sidebarMode != null;
    }

    public prepareForUnmounting() {
        if (this.authoringReactRef == null) {
            return Promise.resolve();
        } else {
            return this.authoringReactRef.initiateUnmounting();
        }
    }

    public handleUnsavedChanges(): Promise<void | IArticle> {
        if (this.authoringReactRef == null) {
            return Promise.resolve();
        } else if (this.authoringReactRef.state.initialized) {
            return this.authoringReactRef.handleUnsavedChanges(this.authoringReactRef.state);
        } else {
            return Promise.reject();
        }
    }

    render() {
        const secondaryToolbarWidgetsFromExtensions = Object.values(extensions)
            .flatMap(({activationResult}) => activationResult?.contributions?.authoringTopbar2Widgets ?? []);

        return (
            <WithInteractiveArticleActionsPanel location="authoring">
                {(panelState, panelActions) => (
                    <AuthoringReact
                        onFieldChange={this.props.onFieldChange}
                        ref={(component) => {
                            this.authoringReactRef = component;
                        }}
                        itemId={this.props.itemId}
                        resourceNames={ARTICLE_RELATED_RESOURCE_NAMES}
                        onClose={() => this.props.onClose()}
                        authoringStorage={this.props.authoringStorage}
                        fieldsAdapter={getFieldsAdapter(this.props.authoringStorage)}
                        storageAdapter={{
                            storeValue: (value, fieldId, article) => {
                                return {
                                    ...article,
                                    extra: {
                                        ...(article.extra ?? {}),
                                        [fieldId]: value,
                                    },
                                };
                            },
                            retrieveStoredValue: (item: IArticle, fieldId) => item.extra?.[fieldId] ?? null,
                        }}
                        headerToolbar={((exposed) => {
                            const getProfileAndReinitialize = (item: IArticle) =>
                                this.props.authoringStorage.getContentProfile(
                                    item,
                                    exposed.fieldsAdapter,
                                ).then((profile) => {
                                    exposed.reinitialize(item, profile);
                                });

                            return [{
                                component: ({entity}) => (
                                    <div className="authoring-header__general-info">
                                        <ContentProfileDropdown
                                            item={entity}
                                            reinitialize={(item) => {
                                                const handledChanges = exposed.hasUnsavedChanges()
                                                    ? exposed.handleUnsavedChanges()
                                                    : Promise.resolve();

                                                handledChanges.then(() => {
                                                    getProfileAndReinitialize(item);
                                                });
                                            }}
                                        />
                                    </div>
                                ),
                                availableOffline: false,
                                group: 'start',
                                priority: 1,
                            }];
                        })}
                        getLanguage={(article) => article.language ?? 'en'}
                        onEditingStart={(article) => {
                            dispatchCustomEvent('articleEditStart', article);
                        }}
                        onEditingEnd={(article) => {
                            dispatchCustomEvent('articleEditEnd', article);
                        }}
                        getActions={({
                            item,
                            contentProfile,
                            fieldsData,
                            getLatestItem,
                            handleUnsavedChanges,
                            hasUnsavedChanges,
                            authoringStorage,
                            fieldsAdapter,
                            storageAdapter,
                        }) => {
                            const authoringActionsFromExtensions = getAuthoringActionsFromExtensions(
                                item,
                                contentProfile,
                                fieldsData,
                            );

                            return [
                                getSaveAsTemplate(getLatestItem),
                                getCompareVersionsModal(
                                    getLatestItem,
                                    authoringStorage,
                                    fieldsAdapter,
                                    storageAdapter,
                                ),
                                getMultiEditModal(getLatestItem),
                                getHighlightsAction(getLatestItem),
                                getMarkedForDesksModal(getLatestItem),
                                getExportModal(getLatestItem, handleUnsavedChanges, hasUnsavedChanges),
                                getTranslateModal(getLatestItem),
                                ...authoringActionsFromExtensions,
                            ];
                        }}
                        getSidebarWidgetsCount={({item}) => getWidgetsFromExtensions(item).length}
                        sideWidget={this.state.sideWidget}
                        onSideWidgetChange={(sideWidget) => {
                            this.setState({sideWidget});
                            closedIntentionally.value = false;
                        }}
                        getInlineToolbarActions={this.props.getInlineToolbarActions}
                        getAuthoringPrimaryToolbarWidgets={
                            this.props.getAuthoringPrimaryToolbarWidgets != null
                                ? () => this.props.getAuthoringPrimaryToolbarWidgets(panelState, panelActions)
                                : undefined
                        }
                        getSidePanel={({
                            item,
                            getLatestItem,
                            contentProfile,
                            fieldsData,
                            handleFieldsDataChange,
                            fieldsAdapter,
                            storageAdapter,
                            authoringStorage,
                            handleUnsavedChanges,
                            sideWidget,
                            onItemChange,
                            addValidationErrors,
                        }, readOnly) => {
                            if (panelState.active === true) {
                                return (
                                    <InteractiveArticleActionsPanel
                                        items={panelState.items}
                                        tabs={panelState.tabs}
                                        activeTab={panelState.activeTab}
                                        handleUnsavedChanges={
                                            () => handleUnsavedChanges().then((res) => [res])
                                        }
                                        onClose={panelActions.closePanel}
                                        onError={(error) => {
                                            if (error.kind === 'publishing-error') {
                                                addValidationErrors(error.fields);
                                            } else {
                                                assertNever(error.kind);
                                            }
                                        }}
                                        onDataChange={(item) => {
                                            onItemChange(item);
                                        }}
                                        markupV2
                                    />
                                );
                            }

                            if (sideWidget == null) {
                                return null;
                            }

                            const WidgetComponent = getWidgetsFromExtensions(item)
                                .find((widget) => sideWidget === widget._id)?.component;

                            return (
                                <WidgetStatePersistenceHOC sideWidgetId={sideWidget}>
                                    {(widgetRef) => (
                                        <WidgetComponent
                                            ref={widgetRef}
                                            initialState={(() => {
                                                const localStorageWidgetState =
                                                    JSON.parse(localStorage.getItem('SIDE_WIDGET') ?? 'null');

                                                if (localStorageWidgetState?.id != null) {
                                                    const initialState = localStorageWidgetState?.initialState;

                                                    sdApi.preferences.update(
                                                        PINNED_WIDGET_USER_PREFERENCE_SETTINGS,
                                                        {type: 'string', _id: localStorageWidgetState?.id},
                                                    );

                                                    // Once a user switches the widget, authoring gets
                                                    // re-rendered 3-4 times, causing this logic to run more
                                                    // than once. To prevent wrong widget state its
                                                    // deleted after 5 seconds.
                                                    setTimeout(() => {
                                                        localStorage.removeItem('SIDE_WIDGET');
                                                    }, 5000);

                                                    closedIntentionally.value = false;
                                                    return initialState;
                                                }

                                                if (
                                                    localStorageWidgetState == null
                                                    && closedIntentionally.value === true
                                                    && widgetState[this.state.sideWidget?.activeId] != null
                                                ) {
                                                    return widgetState[this.state.sideWidget?.activeId];
                                                }

                                                return undefined;
                                            })()}
                                            article={item}
                                            getLatestArticle={getLatestItem}
                                            contentProfile={contentProfile}
                                            fieldsData={fieldsData}
                                            authoringStorage={authoringStorage}
                                            fieldsAdapter={fieldsAdapter}
                                            storageAdapter={storageAdapter}
                                            onFieldsDataChange={handleFieldsDataChange}
                                            readOnly={readOnly}
                                            handleUnsavedChanges={() => handleUnsavedChanges()}
                                            onItemChange={onItemChange}
                                        />
                                    )}
                                </WidgetStatePersistenceHOC>
                            );
                        }}
                        getSidebar={this.state.sidebarMode !== true ? null : (options) => (
                            <AuthoringIntegrationWrapperSidebar
                                options={options}
                                sideWidget={this.state.sideWidget}
                                setSideWidget={(sideWidget) => {
                                    this.setState({sideWidget});
                                    closedIntentionally.value = false;
                                }}
                            />
                        )}
                        getSecondaryToolbarWidgets={(exposed) => [
                            {
                                availableOffline: true,
                                component: () => (
                                    <CreatedModifiedInfo article={exposed.item} />
                                ),
                                group: 'start',
                                priority: 1,
                            },
                            ...secondaryToolbarWidgetsFromExtensions,
                            ...getAuthoringCosmeticActions(exposed),
                        ]}
                        validateBeforeSaving={false}
                        getSideWidgetIdAtIndex={(article, index) => {
                            return getWidgetsFromExtensions(article)[index]._id;
                        }}
                        autoFocus={this.props.autoFocus}
                    />
                )}
            </WithInteractiveArticleActionsPanel>
        );
    }
}
