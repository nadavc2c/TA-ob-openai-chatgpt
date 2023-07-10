import React from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import { connect } from "react-redux";
import Styles from "./AssistantModal.pcssm";
import Modal from "@splunk/react-ui/Modal";
import Button from "@splunk/react-ui/Button";
import Constant from "app/views/subviews/BuildFieldExtraction/Constant";
import SingleSelectControl
    from "app/components/controls/SingleSelectControl.jsx";
import actions from "app/redux/actions/fieldExtraction";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import ControlGroup from "app/components/ControlGroup.jsx";
import { getFormattedMessage } from "app/utils/MessageUtil";
import Collector from "app/profiles/partyjsCollector";

const {
    FMT2LABEL,
    FMT_UNSTRUCTURED,
    FMT_KV,
    FMT_JSON,
    FMT_TABLE,
    FMT_XML
} = Constant;

const FMT2PARSE_ACTION = {
    [FMT_UNSTRUCTURED]: "GET_PARSE_RESULT_FMT_UNSTRUCTURED$",
    [FMT_KV]: "GET_PARSE_RESULT_FMT_KV$",
    [FMT_JSON]: "GET_PARSE_RESULT_GET_EVENT$",
    [FMT_TABLE]: "GET_PARSE_RESULT_FMT_TABLE$",
    [FMT_XML]: "GET_PARSE_RESULT_GET_EVENT$"
};

const getEventCount = (format, data) => {
    let count = 0;
    switch (format) {
        case FMT_UNSTRUCTURED:
            count = _.reduce(
                data,
                (sum, group) => {
                    sum += group.events.length;
                    return sum;
                },
                0
            );
            break;
        case FMT_TABLE:
            count = data.events.length;
            break;
        case FMT_KV:
            count = data.events.length;
            break;
        case FMT_JSON:
            count = data.length;
            break;
        case FMT_XML:
            count = data.length;
            break;
    }
    return count;
};

const getReadableProgress = progress => {
    if (_.isNil(progress)) {
        return "";
    }
    let text = Math.round(progress * 100);
    return `${text}%`;
};

class AssistantModal extends React.Component {
    static propTypes = {
        appName: PropTypes.string,

        parseSourceTypeModal: PropTypes.object,
        metadata: PropTypes.object,
        pendings: PropTypes.object,

        startParse: PropTypes.func,
        cancelParse: PropTypes.func,
        getParsedResult: PropTypes.func,
        closeModal: PropTypes.func,
        setCurrentFormat: PropTypes.func,
        dispatch: PropTypes.func
    };
    constructor(...args) {
        super(...args);
    }
    shouldComponentUpdate(props) {
        const {
            pendings,
            dispatch,
            closeModal,
            appName,
            parseSourceTypeModal,
            metadata
        } = props;
        const data = parseSourceTypeModal.get("data");
        const format = metadata.get("data_format");
        const sourcetype = metadata.get("name");

        if (actions.isActionResolved(pendings, FMT2PARSE_ACTION[format])) {
            if (!this._loadTimeStart) {
                console.log("There is no start time!");
            } else {
                Collector.collect("track_field_extraction", {
                    timeStart: this._loadTimeStart.getTime(),
                    timeEnd: new Date().getTime(),
                    format: format,
                    sourcetype: sourcetype,
                    app_name: appName,
                    num_of_events: getEventCount(format, data)
                });
                this._loadTimeStart = null;
            }
            closeModal();
            dispatch(
                actions.getAction("SET_NAVIGATION", {
                    view: "field-extraction",
                    action: format,
                    params: {
                        sourcetype: sourcetype,
                        data: data,
                        isEditMode: false
                    }
                })
            );
            return false;
        }
        return true;
    }
    onSubmitClick() {
        const { appName, metadata, getParsedResult } = this.props;
        const format = metadata.get("data_format");
        this._loadTimeStart = new Date();
        switch (format) {
            case FMT_KV:
            case FMT_JSON:
            case FMT_TABLE:
            case FMT_XML:
                getParsedResult(FMT2PARSE_ACTION[format], {
                    app_name: appName,
                    sourcetype: metadata.get("name")
                });
                break;
            case FMT_UNSTRUCTURED:
                this.startParse();
        }
    }
    startParse() {
        const { appName, metadata, dispatch } = this.props;
        dispatch(
            actions.getAction("START_PARSE_RESULT_FMT_UNSTRUCTURED$", {
                app_name: appName,
                sourcetype: metadata.get("name")
            })
        );
    }
    cancelParse() {
        const { appName, metadata, dispatch } = this.props;
        dispatch(
            actions.getAction("CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$", {
                app_name: appName,
                sourcetype: metadata.get("name")
            })
        );
    }
    onRequestClose() {
        const { closeModal } = this.props;
        if (!this._isPending() && !this._isInProgress()) {
            closeModal();
        }
    }
    onCancelClick() {
        if (this._isInProgress()) {
            this.cancelParse();
        } else {
            this.onRequestClose();
        }
    }
    _isPending() {
        const { parseSourceTypeModal, pendings } = this.props;
        const metadata = parseSourceTypeModal.get("currentSourceTypeMetadata");
        const format = metadata.get("data_format");
        return _.some(
            [
                FMT2PARSE_ACTION[format],
                "START_PARSE_RESULT_FMT_UNSTRUCTURED$",
                "CANCEL_PARSE_RESULT_FMT_UNSTRUCTURED$"
            ],
            actionName => actions.isActionPending(pendings, actionName)
        );
    }
    _isInProgress() {
        const { parseSourceTypeModal } = this.props;
        const parsingProgress = parseSourceTypeModal.get("parsingProgress");
        return !_.isNil(parsingProgress);
    }
    render() {
        const { parseSourceTypeModal, metadata, setCurrentFormat } = this.props;
        const format = metadata.get("data_format");
        const parsingProgress = parseSourceTypeModal.get("parsingProgress");
        const isPending = this._isPending();
        const isInProgress = this._isInProgress();
        const disableSelect = isPending || isInProgress;
        const disableSubmit =
            !parseSourceTypeModal
                .get("currentSourceTypeMetadata")
                .get("data_format") || disableSelect;
        const error = parseSourceTypeModal.get("error");
        let errorConfig = {};
        if (error) {
            errorConfig = {
                error: true,
                help: error
            };
        }
        return (
            <Modal
                onRequestClose={ this.onRequestClose }
                open={ parseSourceTypeModal.get("isOpen") }
                className={ Styles.root }
            >
                <Modal.Header
                    title={ _.t("Choose Data Format") }
                    className={ Styles.noClose }
                    onRequestClose={ this.onRequestClose }
                />
                <Modal.Body>
                    <div className={ Styles.help }>
                        {getFormattedMessage(4203)}
                    </div>
                    <ControlGroup { ...errorConfig } label="" labelPosition="top">
                        <SingleSelectControl
                            value={ format }
                            placeholder={ _.t("Select...") }
                            onChange={ setCurrentFormat }
                            items={ _.map(
                                [
                                    FMT_UNSTRUCTURED,
                                    FMT_KV,
                                    FMT_JSON,
                                    FMT_TABLE,
                                    FMT_XML
                                ],
                                key => {
                                    return {
                                        label: FMT2LABEL[key],
                                        value: key
                                    };
                                }
                            ) }
                            disabled={ disableSelect }
                        />
                    </ControlGroup>

                </Modal.Body>
                <Modal.Footer>
                    {disableSelect
                        ? <span className={ Styles.wait }>
                              <span className={ Styles.progress }>
                                  {getReadableProgress(parsingProgress)}
                              </span>
                              <WaitSpinner />
                          </span>
                        : null}
                    <Button
                        onClick={ this.onCancelClick }
                        label={ isInProgress ? _.t("Terminate") : _.t("Cancel") }
                        disabled={ isPending }
                    />
                    <Button
                        appearance="primary"
                        onClick={ this.onSubmitClick }
                        label={ _.t("Submit") }
                        disabled={ disableSubmit }
                    />
                </Modal.Footer>
            </Modal>
        );
    }
}
const mapStateToProps = state => {
    return {
        parseSourceTypeModal: state.get("parseSourceTypeModal"),
        metadata: state
            .get("parseSourceTypeModal")
            .get("currentSourceTypeMetadata"),
        pendings: state.get("pendings")
    };
};

const mapDispatchToProps = dispatch => {
    return {
        closeModal: () => {
            dispatch(actions.getAction("CLOSE_MODAL"));
        },
        setCurrentFormat: (event, { value }) => {
            dispatch(actions.getAction("SET_MODAL_SOURCETYPE_FORMAT", value));
        },
        getParsedResult: (action, payload) => {
            dispatch(actions.getAction(action, payload));
        },
        dispatch
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(AssistantModal);
