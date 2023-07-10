import React, { Component } from "react";
import Link from "@splunk/react-ui/Link";
import Switch from "@splunk/react-ui/Switch";
import Tooltip from "@splunk/react-ui/Tooltip";
import Button from "@splunk/react-ui/Button";
import Warning from "@splunk/react-icons/Warning";
import _ from "lodash";
import style from "./cardView.pcssm";
import PropTypes from "prop-types";
import { getFormattedMessage } from "app/utils/MessageUtil";

let cardViewFactory = function(cardfunction, actions = {}) {
    class CardView extends Component {
        static propTypes = {
            mapping: PropTypes.array,
            actions: PropTypes.object,
            data: PropTypes.object,
            checkboxStatus: PropTypes.bool,
            deleteCandidate: PropTypes.object
        };
        constructor(...args) {
            super(...args);
        }
        render() {
            const action_emitter = this.props.actions;
            const isCheckboxHidden = this.props.checkboxStatus;
            let deleteCandidate = this.props.deleteCandidate;
            return (
                <div className={ style["cardContainer"] }>
                    {this.props.data.map((elem, index) => {
                        return (
                            <div
                                key={ index }
                                className={ style["cardViewFlex"] }
                                onClick={ e => {
                                    if (isCheckboxHidden) {
                                        cardfunction(e, elem);
                                    }
                                } }
                            >
                                <div className={ style["cardViewFlexInner"] }>
                                    {!isCheckboxHidden && (
                                        <div className={ style["cardCheckbox"] }>
                                            <Switch
                                                inline={ true }
                                                value={ deleteCandidate.has(elem.get("id")) }
                                                onClick={ () =>
                                                    action_emitter.toggleDeleteCandidate(
                                                        elem.get("id")
                                                    )
                                                }
                                                selected={ deleteCandidate.has(elem.get("id")) }
                                                appearance="checkbox"
                                            />
                                        </div>
                                    )}
                                    {isCheckboxHidden &&
                                        !!elem.get("create_by_builder") &&
                                        !!elem.getIn(["upgrade_info", "err_code"]) && (
                                            <div className={ style["cardWarningIcon"] }>
                                                <Tooltip content={ getFormattedMessage(80) }>
                                                    <Button
                                                        appearance="pill"
                                                        icon={
                                                            <Warning
                                                                screenReaderText={ getFormattedMessage(
                                                                    80
                                                                ) }
                                                            />
                                                        }
                                                        style={ {
                                                            color: "#F8BE34",
                                                            fontSize: 18,
                                                            pointerEvents: "none"
                                                        } }
                                                    />
                                                </Tooltip>
                                            </div>
                                        )}
                                    <div className={ style["cardViewFlexImgAndInfo"] }>
                                        <img
                                            src={ elem.get("icon") }
                                            className={ style["iconImage"] }
                                        />
                                        <div className={ style["cardContent"] }>
                                            <h3
                                                className={ style["cardName"] }
                                                title={ elem.get("name") }
                                            >
                                                {elem.get("name")}
                                            </h3>
                                            <div
                                                className={ style["cardSub"] }
                                                title={ elem.get("author") }
                                            >
                                                {_.t(elem.get("author"))}
                                            </div>
                                            <div
                                                className={ style["cardSub"] }
                                                title={ elem.get("last_modified") }
                                            >
                                                <div>{_.t(elem.get("last_modified"))}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={ style["cardAction"] }>
                                        <div
                                            className={ style["actionLabel"] }
                                            title={ elem.get("version") }
                                        >
                                            {elem.get("version") ? "V" + elem.get("version") : null}
                                        </div>
                                        <span className={ style["actionGroup"] }>
                                            {_.map(actions, (actionElem, index) => (
                                                <div
                                                    key={ "tableCell" + index }
                                                    style={ {
                                                        display: "inline-block"
                                                    } }
                                                >
                                                    <Link
                                                        className={
                                                            index
                                                                ? style["actionButton"]
                                                                : style["actionButtonFirst"]
                                                        }
                                                        onClick={ e => {
                                                            e.stopPropagation();
                                                            if (isCheckboxHidden) {
                                                                actionElem[1](e, elem);
                                                            }
                                                        } }
                                                        key={ "tableButton" + index }
                                                    >
                                                        {_.t(actionElem[0])}
                                                    </Link>
                                                </div>
                                            ))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {_.map(new Array(5), (val, index) => {
                        return <div key={ index } className={ style["cardViewFlex"] } />;
                    })}
                </div>
            );
        }
    }
    return CardView;
};

export { cardViewFactory };
