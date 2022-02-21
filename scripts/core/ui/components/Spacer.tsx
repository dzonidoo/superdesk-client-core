/* eslint-disable react/no-multi-comp */

import React from 'react';
import {IPropsSpacer, IPropsSpacerInline} from 'superdesk-api';

export class Spacer extends React.PureComponent<IPropsSpacer> {
    render() {
        const {h, v, gap, justifyContent, alignItems, noGrow, noWrap} = this.props;

        const justifyContentDefault: IPropsSpacer['justifyContent'] = h ? 'space-between' : 'start';
        const alignItemsDefault: IPropsSpacer['alignItems'] = h ? 'center' : 'start';

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: v ? 'column' : 'row',
                    gap: `${gap}px`,
                    justifyContent: justifyContent ?? justifyContentDefault,
                    alignItems: alignItems ?? alignItemsDefault,
                    width: noGrow === true ? undefined : '100%',
                }}
            >
                {this.props.children.map((el, i) => noWrap ? el : (
                    <div
                        key={i}
                        style={{
                            width: noGrow === true ? undefined : '100%',
                        }}
                    >
                        {el}
                    </div>
                ))}
            </div>
        );
    }
}

export class SpacerInline extends React.PureComponent<IPropsSpacerInline> {
    render() {
        const {gap, h, v} = this.props;

        return (
            <span
                style={{
                    display: h === true ? 'inline-block' : 'block',
                    width: h === true ? `${gap}px` : undefined,
                    height: v === true ? `${gap}px` : undefined,
                }}
            />
        );
    }
}
