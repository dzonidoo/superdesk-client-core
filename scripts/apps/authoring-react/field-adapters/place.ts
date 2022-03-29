import {Map} from 'immutable';
import {IAuthoringFieldV2, IRestApiResponse, IVocabularyItem} from 'superdesk-api';
import {gettext} from 'core/utils';
import {IFieldAdapter} from '.';
import {IDropdownConfigRemoteSource, IDropdownConfigVocabulary, IDropdownValue} from '../fields/dropdown';
import {isMultipleV2} from './utilities';
import {authoringStorage} from '../data-layer';
import ng from 'core/services/ng';
import {httpRequestJsonLocal} from 'core/helpers/network';
import {IGeoName} from 'apps/authoring/metadata/PlacesService';
import {ITreeWithLookup} from 'core/ui/components/MultiSelectTreeWithTemplate';

export function getPlaceAdapter(): IFieldAdapter {
    const useGeoNamesApi = ng.get('features').places_autocomplete;

    if (useGeoNamesApi) {
        return {
            getFieldV2: (fieldEditor, fieldSchema) => {
                const fieldConfig: IDropdownConfigRemoteSource = {
                    readOnly: fieldEditor.readonly,
                    required: fieldEditor.required,
                    source: 'remote-source',
                    searchOptions: (searchTerm, language, callback) => {
                        httpRequestJsonLocal<IRestApiResponse<IGeoName>>({
                            method: 'GET',
                            path: '/places_autocomplete',
                            urlParams: {
                                lang: language,
                                name: searchTerm,
                            },
                        }).then((res) => {
                            const tree: ITreeWithLookup<IGeoName> = {
                                nodes: res._items.map((item) => ({value: item})),
                                lookup: {},
                            };

                            callback(tree);
                        });
                    },
                    getId: (option: IGeoName) => option.code,
                    getLabel: (option: IGeoName) => option.name,
                    multiple: true,
                };

                const fieldV2: IAuthoringFieldV2 = {
                    id: 'place',
                    name: gettext('Place'),
                    fieldType: 'dropdown',
                    fieldConfig,
                };

                return fieldV2;
            },
            getSavedData: (article) => {
                return article.place;
            },
            saveData: (val: IDropdownValue, article) => {
                return {
                    ...article,
                    place: val,
                };
            },
        };
    } else { // use "locators" vocabulary
        return {
            getFieldV2: (fieldEditor, fieldSchema) => {
                const multiple = isMultipleV2('locators');

                const fieldConfig: IDropdownConfigVocabulary = {
                    readOnly: fieldEditor.readonly,
                    required: fieldEditor.required,
                    source: 'vocabulary',
                    vocabularyId: 'locators',
                    multiple: multiple,
                };

                const fieldV2: IAuthoringFieldV2 = {
                    id: 'place',
                    name: gettext('Place'),
                    fieldType: 'dropdown',
                    fieldConfig,
                };

                return fieldV2;
            },
            getSavedData: (article) => {
                const multiple = isMultipleV2('locators');

                if (multiple) {
                    return article.place.map(({qcode}) => qcode);
                } else {
                    return article.place.map(({qcode}) => qcode)[0];
                }
            },
            saveData: (val: IDropdownValue, article) => {
                const vocabulary = authoringStorage.getVocabularies().get('locators');
                const vocabularyItems = Map<IVocabularyItem['qcode'], IVocabularyItem>(
                    vocabulary.items.map((item) => [item.qcode, item]),
                );

                if (Array.isArray(val)) {
                    return {
                        ...article,
                        place: val.map(
                            (qcode) => ({qcode, name: vocabularyItems.get(qcode.toString())?.name ?? ''}),
                        ),
                    };
                } else {
                    const qcode = val;

                    return {
                        ...article,
                        place: [{qcode, name: vocabularyItems.get(qcode.toString())?.name ?? ''}],
                    };
                }
            },
        };
    }
}
