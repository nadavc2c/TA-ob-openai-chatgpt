import Button from "@splunk/react-ui/Button";
import Dropdown from "app/views/common/Dropdown";
import Menu from "@splunk/react-ui/Menu";
import React from "react";
import _ from "lodash";
import {
    SORTBY_PREFIX,
    DEFAULT_SORT
} from "app/views/subviews/Home/homePageConstant";
import PropTypes from "prop-types";

class DropDownSort extends React.Component {
    static propTypes = {
        mapping: PropTypes.array,
        actions: PropTypes.object,
        sortKey: PropTypes.string,
        handleSortChoice: PropTypes.object
    };
    static defaultProps = {
        sortKey: DEFAULT_SORT.sortKey
    };
    constructor(...args) {
        super(...args);
    }

    handleChange(value) {
        this.props.actions.sortTable(value, "desc");
        this.props.handleSortChoice.setSortChoice({
            sortKey: value,
            SortDir: "desc"
        });
    }

    render() {
        const sortField = _.filter(
            this.props.mapping,
            elem => elem.sortKey === this.props.sortKey
        )[0];
        const label =
            SORTBY_PREFIX +
            " " +
            (sortField ? sortField.label : _.t("Last Modified"));
        const toggle = <Button label={ label } isMenu />;
        return (
            <Dropdown
                toggle={ toggle }
            >
                <Menu style={ { width: 150 } }>
                    {this.props.mapping.map((elem, index) => (
                        <Menu.Item
                            key={ index }
                            onClick={ () => this.handleChange(elem.sortKey) }
                        >
                        { SORTBY_PREFIX + " " + elem.label }
                        </Menu.Item>
                    ))}
                </Menu>
            </Dropdown>
        );
    }
}

export default DropDownSort;
