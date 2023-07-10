import React from 'react';
import _ from 'lodash';
import Styles from './ValueDefinitionTable.pcssm';
import Button from '@splunk/react-ui/Button';
import Text from '@splunk/react-ui/Text';
import Close from '@splunk/react-icons/Close';
import { createTestHook } from 'app/utils/testSupport';
import PropTypes from 'prop-types';

export default class ValueDefinitionTable extends React.Component {
    static defaultProps = {
        rows: [],
        onChange: _.noop,
        labelTextType: 'text',
        valueTextType: 'text',
        labelKeyName: 'label',
        valueKeyName: 'value',
        labelHeadText: _.t('Display label'),
        valueHeadText: _.t('Internal value'),
        butonText: _.t('New Pair')
    };

    static propTypes = {
        rows: PropTypes.array,
        onChange: PropTypes.func,
        labelTextType: PropTypes.string,
        valueTextType: PropTypes.string,
        labelKeyName: PropTypes.string,
        valueKeyName: PropTypes.string,
        labelHeadText: PropTypes.string,
        valueHeadText: PropTypes.string,
        buttonText: PropTypes.string,
    }
    constructor(...args) {
        super(...args);
    }
    render() {
        const {
            rows,
            labelTextType,
            valueTextType,
            labelKeyName,
            valueKeyName,
            labelHeadText,
            valueHeadText,
            buttonText
        } = this.props;
        return <div
            className={ Styles.root }
            { ...createTestHook(__filename) }
        >
            <table className={ Styles.table } >
                <thead>
                    <tr>
                        <th>{ labelHeadText }</th>
                        <th>{ valueHeadText }</th>
                    </tr>
                </thead>
                <tbody>
                    { _.map(rows, (row, index) => {
                        const {
                            [valueKeyName]: value,
                            [labelKeyName]: label,
                        } = row;
                        return <tr key={ index }>
                            <td>
                                <Text
                                    // style={{width: 90}}
                                    value={ label }
                                    onChange={ (event, { value }) => {
                                        let changes = _.cloneDeep(rows);
                                        changes[index][labelKeyName] = value;
                                        this.props.onChange(event, {
                                            value: changes
                                        });
                                    } }
                                    type={ labelTextType }
                                    inline
                                />
                            </td>
                            <td>
                                <Text
                                    // style={{width: 90}}
                                    value={ value }
                                    onChange={ (event, { value }) => {
                                        let changes = _.cloneDeep(rows);
                                        changes[index][valueKeyName] = value;
                                        this.props.onChange(event, {
                                            value: changes
                                        });
                                    } }
                                    type={ valueTextType }
                                    inline
                                />
                            </td>
                            <td>
                                <span className={ Styles.remove } >
                                    <Close
                                        onClick={ (event) => {
                                            let changes = _.without(rows, row);
                                            this.props.onChange(event, {
                                                value: changes
                                            });
                                        } }
                                    />
                                </span>
                            </td>
                        </tr>;
                    } ) }
                </tbody>
            </table>
            <Button
                label={ buttonText }
                appearance="pill"
                onClick={ (event) => {
                    let changes = _.cloneDeep(rows);
                    changes.push({
                        [valueKeyName]: '',
                        [labelKeyName]: '',
                    });
                    this.props.onChange(event, {
                        value: changes
                    });

                } }
            />
        </div>;
    }
}
