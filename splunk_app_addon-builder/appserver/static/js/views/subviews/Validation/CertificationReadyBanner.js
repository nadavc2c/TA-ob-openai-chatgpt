import _ from "lodash";
import $ from "jquery";
import Backbone from "backbone";
import Template from "contrib/text!./CertificationReadyBanner.html";
import CertInternalErrDialog from "./CertInternalErrDialog";
import BaseSearchPresenter from "app/views/subviews/BaseSearchPresenter";
import * as MessageUtil from "app/utils/MessageUtil";

export default BaseSearchPresenter.extend({
    template: Template,
    model: new Backbone.Model(),
    className: "ta-certification-ready-banner-content",
    placerHoldTemp: _.template(
        `<div class="ta-waiting-for-data">
                                    <%- _.t('Waiting for data') + '...' %>
                                </div>`
    ),
    terminatedTemp: _.template(
        `<div class="ta-waiting-for-data">
                                    <%- _.t('Validation is terminated.') %>
                                </div>`
    ),
    initialize() {
        BaseSearchPresenter.prototype.initialize.apply(this, arguments);
        this.listenTo(
            this.searchManager,
            "search:failed",
            this.onSearchFinished
        );
        this.listenTo(this.searchManager, "search:done", this.onSearchFinished);
        this.listenTo(this.searchManager, "search:start", this.onSearchStart);
        this.errorEventResults = this.options.errorSearch.data("results");
        this.warnEventResults = this.options.warnSearch.data("results");
        this.listenTo(this.errorEventResults, "data", this.onErrorCntChange);
        this.listenTo(this.warnEventResults, "data", this.onWarnCntChange);
        this.certReadyTitle = MessageUtil.getFormattedMessage(32);
        this.certNotReadyTitle = MessageUtil.getFormattedMessage(33);
        this.certReadyDesc = MessageUtil.getFormattedMessage(30);
        this.certNotReadyDesc = MessageUtil.getFormattedMessage(31);
        this.parentView = this.options.parentView;
        return this;
    },
    render() {
        this._renderBanner();
        return this;
    },
    onWarnCntChange() {
        let d = this.warnEventResults.data();
        if (d) {
            let row = {};
            for (let i = 0; i < d.fields.length; i++) {
                row[d.fields[i]] = d.rows[0][i];
            }
            this.model.set("warns", row.tcount);
            this._renderBanner();
        }
    },
    onErrorCntChange() {
        let d = this.errorEventResults.data();
        if (d) {
            let row = {};
            for (let i = 0; i < d.fields.length; i++) {
                row[d.fields[i]] = d.rows[0][i];
            }
            this.model.set("errors", row.tcount);
            this._renderBanner();
        }
    },
    onDataChange() {
        let d = this.getResult();
        let eventList = [];
        if (d) {
            for (let j = 0; j < d.rows.length; j++) {
                let e = {};
                for (let i = 0; i < d.fields.length; i++) {
                    if (!d.fields[i].startsWith("_")) {
                        e[d.fields[i]] = d.rows[j][i];
                    }
                }
                eventList.push(e);
            }

            this.model.set("internal_errors", eventList.length);
            this.model.set("internal_error_events", eventList);
            this._renderBanner();
        }
    },
    onSearchFinished() {
        if (!this.model.has("internal_errors")) {
            this.model.set("internal_errors", 0);
        }
        this._renderBanner();
    },
    onSearchStart() {
        this.model.clear();
        this._renderBanner();
    },
    showInternalErrorDetail() {
        let events = this.model.get("internal_error_events");
        let rootEl = $("#alert-modal");
        rootEl.empty();
        let dialog = new CertInternalErrDialog({
            el: rootEl,
            errors: events
        });
        dialog.showModal();
    },

    _renderBanner() {
        // check if all the data is ready
        if (
            this.model.has("errors") &&
            this.model.has("warns") &&
            this.model.has("internal_errors")
        ) {
            if (!this.parentView.isValidationTerminated()) {
                let errs = this.model.get("errors");
                let internalErrs = this.model.get("internal_errors");
                this.$el.html(
                    this.compiledTemplate({
                        title: errs > 0
                            ? this.certNotReadyTitle
                            : this.certReadyTitle,
                        description: errs > 0
                            ? this.certNotReadyDesc
                            : this.certReadyDesc,
                        internalErrCnt: internalErrs
                    })
                );
                this.$(".ta-cert-detail-link").click(e => {
                    e.preventDefault();
                    this.showInternalErrorDetail();
                });
            } else {
                this.$el.html(this.terminatedTemp());
            }
        } else {
            this.$el.html(this.placerHoldTemp());
        }
    }
});
