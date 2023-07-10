import Paginator from "@splunk/react-ui/Paginator";
import React from "react";
import * as uuid from "uuid";
import PropTypes from "prop-types";
/*
totalpage
current
 paginator actions must named setPage
*/
class Basic extends React.Component {
    static propTypes = {
        pageInfo: PropTypes.array,
        actions: PropTypes.object
    };
    constructor(props, context) {
        super(props, context);
        this.id = uuid.v1();
    }

    onChange(e, { page }) {
        this.props.actions.setPage(page - 1);
    }

    render() {
        const current = this.props.pageInfo[1];
        const totalPages = this.props.pageInfo[2];
        const numPageLinks = Math.min(totalPages, 9);
        return (
            totalPages > 1 &&
            <Paginator
                numPageLinks={ numPageLinks }
                onChange={ this.onChange }
                current={ current }
                totalPages={ totalPages }
            />
        );
    }
}

export default Basic;
