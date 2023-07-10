import React from "react";
import _ from "lodash";
import Styles from "./ValueDefinitionTable.pcssm";
import Button from "@splunk/react-ui/Button";
import Text from "@splunk/react-ui/Text";
import Switch from "@splunk/react-ui/Switch";
import Close from "@splunk/react-icons/Close";
import { convertNameToInternalName } from "app/utils/NameConvertUtil";
import { createTestHook } from "app/utils/testSupport";
import PropTypes from "prop-types";

const OPTION_NAME_BASE = "Option";

const generateNewOption = rows => {
    const names = _.map(rows, "label");
    let count = 1;
    let name = `${OPTION_NAME_BASE}${count}`;
    while (_.includes(names, name)) {
        count++;
        name = `${OPTION_NAME_BASE}${count}`;
    }
    return {
        label: name,
        value: convertNameToInternalName(name)
    };
};

export default class ValueDefinitionTable extends React.Component {
    static defaultProps = {
        rows: [],
        defaultSelection: "",
        onChange: _.noop,
        onDefaultSelectionChange: _.noop,
        multiple: false
    };

    static propTypes = {
        rows: PropTypes.array,
        defaultSelection: PropTypes.oneOfType([
            PropTypes.array,
            PropTypes.string
        ]),
        onChange: PropTypes.func,
        onDefaultSelectionChange: PropTypes.func,
        multiple: PropTypes.bool
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { rows, defaultSelection, multiple } = this.props;
        const defaults = _.castArray(defaultSelection);
        return (
            <div className={ Styles.root } { ...createTestHook(__filename) }>
                <table className={ Styles.table }>
                    <thead>
                        <tr>
                            <th>{_.t("Display label")}</th>
                            <th>{_.t("Internal value")}</th>
                            <th>{_.t("Default value")}</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {_.map(rows, (row, index) => {
                            const value = row.value;
                            const isDefault = _.includes(defaults, value);
                            return (
                                <tr key={ index }>
                                    <td>
                                        <Text
                                            style={ { width: 90 } }
                                            value={ row.label }
                                            onChange={ (event, { value }) => {
                                                let changes = _.cloneDeep(rows);
                                                changes[index].label = value;
                                                this.props.onChange(event, {
                                                    value: changes
                                                });
                                                if (isDefault) {
                                                    //TODO remove this work around after adapting redux.
                                                    _.delay(() => {
                                                        this.props.onDefaultSelectionChange(
                                                            event,
                                                            {
                                                                value: defaultSelection
                                                            }
                                                        );
                                                    });
                                                }
                                            } }
                                            inline
                                        />
                                    </td>
                                    <td>
                                        <Text
                                            style={ { width: 90 } }
                                            value={ value }
                                            onChange={ (event, { value }) => {
                                                let changes = _.cloneDeep(rows);
                                                changes[index].value = value;
                                                this.props.onChange(event, {
                                                    value: changes
                                                });
                                                if (isDefault) {
                                                    let changes = value;
                                                    if (multiple) {
                                                        changes = _.cloneDeep(
                                                            defaultSelection
                                                        );
                                                        changes[
                                                            _.indexOf(
                                                                defaultSelection,
                                                                rows[index]
                                                                    .value
                                                            )
                                                        ] = value;
                                                    }
                                                    //TODO remove this work around after adapting redux.
                                                    _.delay(() => {
                                                        this.props.onDefaultSelectionChange(
                                                            event,
                                                            {
                                                                value: changes
                                                            }
                                                        );
                                                    });
                                                }
                                            } }
                                            inline
                                        />
                                    </td>
                                    <td>
                                        <Switch
                                            value={ row.value }
                                            selected={ isDefault }
                                            appearance={
                                                multiple ? "checkbox" : "radio"
                                            }
                                            onClick={ (event, { value }) => {
                                                let change;
                                                if (multiple) {
                                                    if (
                                                        _.includes(
                                                            defaults,
                                                            value
                                                        )
                                                    ) {
                                                        change = _.without(
                                                            defaults,
                                                            value
                                                        );
                                                    } else {
                                                        change = _.concat(
                                                            defaults,
                                                            value
                                                        );
                                                    }
                                                } else {
                                                    change = value;
                                                }
                                                this.props.onDefaultSelectionChange(
                                                    event,
                                                    {
                                                        value: change
                                                    }
                                                );
                                            } }
                                            inline
                                        />
                                    </td>
                                    <td>
                                        <span className={ Styles.remove }>
                                            <Close
                                                onClick={ event => {
                                                    let changes = _.without(
                                                        rows,
                                                        row
                                                    );
                                                    this.props.onChange(event, {
                                                        value: changes
                                                    });
                                                    if (isDefault) {
                                                        let changes = "";
                                                        if (multiple) {
                                                            changes = _.without(
                                                                defaults,
                                                                value
                                                            );
                                                        }
                                                        //TODO remove this work around after adapting redux.
                                                        _.delay(() => {
                                                            this.props.onDefaultSelectionChange(
                                                                event,
                                                                {
                                                                    value: changes
                                                                }
                                                            );
                                                        });
                                                    }
                                                } }
                                            />
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Button
                    appearance="pill"
                    label={ _.t("New Option") }
                    onClick={ event => {
                        let changes = _.cloneDeep(rows);
                        changes.push(generateNewOption(rows));
                        this.props.onChange(event, {
                            value: changes
                        });
                    } }
                />
            </div>
        );
    }
}
