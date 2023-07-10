import BaseSubViewComponent from "app/views/subviews/BaseSubViewComponent";

export default BaseSubViewComponent.extend({
    className: "ta-search-presenter",
    initialize() {
        BaseSubViewComponent.prototype.initialize.apply(this, arguments);
        this.searchManager = this.options.searchManager;
        if (!this.searchManager) {
            throw Error("This view must be used with a search manager.");
        }
        this.searchResults = this.searchManager.data("results");
        this.searchPreview = this.searchManager.data("preview");
    },
    render() {
        return this;
    },
    startPreviewListening() {
        this.listenTo(this.searchPreview, "data", this.onPreviewDataChange);
        this.stopListening(this.searchResults);
    },
    startResultsListening() {
        this.listenTo(this.searchResults, "data", this.onResultsDataChange);
        this.stopListening(this.searchPreview);
    },
    onPreviewDataChange(model, data) {
        if (!model.hasData()) {
            return;
        }
        if (data && data.fields && data.fields.length) {
            this.onDataChange(data);
        }
    },
    onResultsDataChange(model, data) {
        if (!data) {
            return;
        }
        this.onDataChange(data);
    },
    onDataChange() {
        // To be implemented in children.
    },
    getResult() {
        return this.searchResults.data();
    }
});
