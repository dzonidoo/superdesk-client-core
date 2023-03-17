import React from 'react';
import {IAuthoringFieldV2, IFieldsV2, IVocabularyItem} from 'superdesk-api';
import {Map} from 'immutable';
import {IAuthoringValidationErrors, IToggledFields} from '../authoring-react';
import {AuthoringSectionField} from './authoring-section-field';
import {ItemMgridTemplate} from 'apps/search/components/ItemMgridTemplate';

export interface IPropsAuthoringSection {
    language: string;
    fieldsData: Map<string, unknown>;
    fields: IFieldsV2;
    onChange(fieldId: string, value: unknown): void;
    readOnly: boolean;
    userPreferencesForFields: {[fieldId: string]: unknown};
    useHeaderLayout?: boolean;
    toggledFields: IToggledFields;
    toggleField(fieldId: string): void;
    setUserPreferencesForFields(userPreferencesForFields: {[fieldId: string]: unknown}): void;
    getVocabularyItems(vocabularyId: string): Array<IVocabularyItem>;
    validationErrors: IAuthoringValidationErrors;
}

function groupItemsToRow<T>(items: Array<T>, getWidth: (item: T) => number) {
    debugger;
    const itemGroups: Array<Array<T>> = [
        [],
    ];

    let rowWidth = 0; // percent

    for (const item of items) {
        const itemWidth = getWidth(item);
        
        const fitOnThisRow = rowWidth + itemWidth <= 100;
        
        if (fitOnThisRow) {
            rowWidth = rowWidth + itemWidth;

            
        } else {
            itemGroups.push([]);
            rowWidth = 0;

        }

        const lastGroup = itemGroups[itemGroups.length - 1];

        lastGroup.push(item);

    }

    return itemGroups;
}

/**
 * A variable is needed in order to use the same object reference
 * and allow PureComponent to skip re-renders.
 */
const defaultUserPreferences = {};

export class AuthoringSection extends React.PureComponent<IPropsAuthoringSection> {
    constructor(props: IPropsAuthoringSection) {
        super(props);

        this.onEditorPreferencesChange = this.onEditorPreferencesChange.bind(this);
    }

    onEditorPreferencesChange(fieldId: string, preferences: unknown) {
        this.props.setUserPreferencesForFields({
            ...(this.props.userPreferencesForFields ?? {}),
            [fieldId]: preferences,
        });
    }

    render() {
        const {toggledFields} = this.props;
        
        const grouped = groupItemsToRow(this.props.fields.toArray(), (field) => field.fieldConfig.width);

        console.log(grouped);
        
        
        return (
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>

                {grouped.map((group) => (
                    <div style={{display: 'flex', gap: '20px'}}>
                        {
                            group.map((field) => {
                                const canBeToggled = toggledFields[field.id] != null;
                                const toggledOn = toggledFields[field.id];
        
                                return (
                                    <div style={{width: `${field.fieldConfig.width}%`}}>
                                        <AuthoringSectionField
                                            key={field.id}
                                            field={field}
                                            fieldsData={this.props.fieldsData}
                                            onChange={this.props.onChange}
                                            readOnly={this.props.readOnly}
                                            language={this.props.language}
                                            canBeToggled={canBeToggled}
                                            toggledOn={toggledOn}
                                            toggleField={this.props.toggleField}
                                            editorPreferences={
                                                this.props.userPreferencesForFields[field.id] ?? defaultUserPreferences
                                            }
                                            onEditorPreferencesChange={this.onEditorPreferencesChange}
                                            useHeaderLayout={this.props.useHeaderLayout}
                                            getVocabularyItems={this.props.getVocabularyItems}
                                            validationError={this.props.validationErrors[field.id]}
                                        />
                                    </div>
                                );
                            })
                        }
                    </div>
                ))}
            </div>
        );
    }
}
