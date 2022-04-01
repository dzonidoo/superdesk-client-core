import * as React from 'react';
import {SelectFilterable} from 'core/ui/components/select-filterable';
import {MultiSelectTreeWithTemplate} from 'core/ui/components/MultiSelectTreeWithTemplate';
import {IDropdownConfigManualSource, IDropdownConfigVocabulary, IDropdownValue} from '.';
import {DropdownItemTemplate} from './dropdown-item-template';
import {getOptions} from './dropdown-vocabulary/get-options';
import {assertNever} from 'core/helpers/typescript-helpers';
import {IVocabularyItem, IVocabulary} from 'superdesk-api';

interface IProps {
    config: IDropdownConfigManualSource | IDropdownConfigVocabulary;
    value: IDropdownValue;
    language: string;
    getVocabularyItems(vocabulary: IVocabulary['_id']): Array<IVocabularyItem>;
    onChange(value: IDropdownValue): void;
}

export class EditorUsingManualSourceOrVocabulary extends React.PureComponent<IProps> {
    render() {
        const {config} = this.props;
        const values = this.props.value;

        const options = (() => {
            if (config.source === 'manual-entry') {
                return config.options;
            } else if (config.source === 'vocabulary') {
                return getOptions(config, this.props.getVocabularyItems);
            } else {
                assertNever(config);
            }
        })();

        if (config.multiple) {
            if (!Array.isArray(values)) {
                throw new Error('Value must be an array');
            }

            const selected = options.filter((opt) => (values).includes(opt.id));
            const noPadding = selected.every(({color}) => color == null);

            return (
                <MultiSelectTreeWithTemplate
                    kind="synchronous"
                    getOptions={() => ({
                        nodes: options.map((option) => ({value: option})),
                        lookup: {},
                    })}
                    values={selected}
                    onChange={(_values) => {
                        this.props.onChange(_values.map((val) => val.id));
                    }}
                    optionTemplate={({item}) => (
                        <DropdownItemTemplate
                            option={item}
                            config={config}
                            noPadding={false}
                        />
                    )}
                    valueTemplate={({item}) => (
                        <DropdownItemTemplate
                            option={item}
                            config={config}
                            noPadding={noPadding}
                        />
                    )}
                    getId={(option) => option.id.toString()}
                    getLabel={(option) => option.label}
                />
            );
        } else {
            return (
                <SelectFilterable
                    items={options}
                    value={options.find(({id}) => id === this.props.value) ?? null}
                    onChange={(option) => {
                        this.props.onChange(option?.id ?? null);
                    }}
                    getLabel={(item) => item?.label}
                    itemTemplate={(item) => (
                        <DropdownItemTemplate
                            option={item.option}
                            config={config}
                            noPadding={false}
                        />
                    )}
                    zIndex={1050}
                    disabled={config.readOnly === true}
                />
            );
        }
    }
}