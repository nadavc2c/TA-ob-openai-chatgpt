import React from "react";
import Styles from "./Row.pcssm";
import Table from "@splunk/react-ui/Table";
import _ from "lodash";
import PropTypes from "prop-types";

class Row extends React.Component {
    static propTypes = {
        message: PropTypes.string
    };
    constructor(...args) {
        super(...args);
    }
    render() {
        const { message } = this.props;
        return message
            ? <Table.Row style={ { height: 26 } }>
                  <Table.Cell>
                      <div className={ Styles.error }>
                          {_.unescape(message)}
                      </div>
                  </Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
              </Table.Row>
            : <Table.Row />;
    }
}

export default Row;
