import _ from "lodash";
import Template from "contrib/text!./ColumnChartPresenter.html";
import BaseSearchPresenter from "app/views/subviews/BaseSearchPresenter";

class DataParser {
    constructor(data, key) {
        this._data = data;
        this._fields = data.fields;
        this._rows = data.rows;
        this._key = key;
        this._buildKeyDict();
    }
    _buildKeyDict() {
        let keyDict = (this._keyDict = {});
        let keyIdx = this._fields.indexOf(this._key);
        _.each(this._rows, row => {
            let dict = {};
            _.each(row, (cell, idx) => {
                if (idx === keyIdx) {
                    keyDict[cell] = dict;
                } else {
                    dict[this._fields[idx]] = cell;
                }
            });
        });
    }
    getItem(key) {
        return this._keyDict[key];
    }
}

function getChildIndex(node) {
    var i = 0;
    while ((node = node.previousSibling) != null)
        {i++;}
    return i;
}

export default BaseSearchPresenter.extend({
    template: Template,
    className: "ta-search-presenter ta-column-chart-presenter",
    initialize() {
        BaseSearchPresenter.prototype.initialize.apply(this, arguments);
        this.categories = this.options.categories || [];
        this.categoryMapper = this.options.categoryMapper || _.noop;
    },
    render() {
        this.$el.html(this.compiledTemplate());
        return this;
    },
    onDataChange(data) {
        let that = this;
        let categoryMap = this.categoryMapper() || {};
        let parser = new DataParser(data, "category");
        // Hardcode series names here.
        let colors = ["#ff4f5a", "#ffd162", "#5dc05c"];
        let series = _.map(["Error", "Warning", "Pass"], (seriesName, idx) => {
            return {
                name: seriesName,
                color: colors[idx],
                data: _.map(this.categories, category => {
                    let item = parser.getItem(category) || {};
                    return isNaN(+item[seriesName]) ? 0 : +item[seriesName];
                })
            };
        });
        let chartInstance = this.$(".ta-chart-container").highcharts();
        if (!chartInstance) {
            this.$(".ta-chart-container").empty().highcharts({
                title: {
                    text: null
                },
                chart: {
                    type: "column",
                    height: 370,
                    events: {
                        click: function() {
                            let points = this.getSelectedPoints();
                            _.each(points, point => {
                                point.select(false, false);
                            });
                            that.trigger("select", null, null);
                        }
                    }
                },
                xAxis: {
                    categories: this.categories,
                    labels: {
                        formatter: function() {
                            return categoryMap[this.value]
                                ? categoryMap[this.value]
                                : this.value;
                        },
                        style: {
                            cursor: "pointer"
                        }
                    }
                },
                yAxis: {
                    title: null
                },
                legend: {
                    align: "right",
                    layout: "vertical",
                    verticalAlign: "top"
                },
                plotOptions: {
                    column: {
                        maxPointWidth: 50,
                        stacking: "normal",
                        dataLabels: {
                            enabled: true
                        }
                    },
                    series: {
                        cursor: "pointer",
                        events: {
                            legendItemClick: function() {
                                let points = this.chart.getSelectedPoints();
                                _.each(points, point => {
                                    point.select(false, false);
                                });

                                points = this.data;
                                _.each(points, point => {
                                    point.select(true, true);
                                });
                                that.trigger("select", this.name, null);
                                return false;
                            }
                        },
                        point: {
                            events: {
                                click: function() {
                                    this.select(true, false);
                                    that.trigger(
                                        "select",
                                        this.series.name,
                                        this.category
                                    );
                                }
                            }
                        },
                        dataLabels: {
                            enabled: true,
                            formatter: function() {
                                if (this.y !== 0) {
                                    return this.y;
                                }
                            },
                            style: {
                                fontWeight: "normal",
                                textShadow: "0 0 0"
                            },
                            verticalAlign: "top"
                        }
                    }
                },
                series: series,
                tooltip: {
                    enabled: false
                },
                credits: {
                    enabled: false
                }
            });
        } else {
            _.each(chartInstance.series, (serie, idx) => {
                serie.setData(series[idx].data);
            });
        }
        // Listen to axis click events to support axis label selection.
        this.$(".highcharts-xaxis-labels text").off().click(e => {
            let cateIdx = getChildIndex(e.currentTarget);
            let chartInstance = this.$(".ta-chart-container").highcharts();
            let points = chartInstance.getSelectedPoints();
            _.each(points, point => {
                point.select(false, false);
            });
            _.each(chartInstance.series, serie => {
                _.each(serie.data, (point, idx) => {
                    if (idx === cateIdx) point.select(true, true);
                });
            });
            this.trigger("select", null, this.categories[cateIdx]);
        });
    },
    remove() {
        if (this.$(".ta-chart-container").highcharts()) {
            this.$(".ta-chart-container").highcharts().destroy();
        }
        BaseSearchPresenter.prototype.remove.apply(this);
    },
    unselectColumns() {
        if (this.$(".ta-chart-container").highcharts()) {
            _.each(
                this.$(".ta-chart-container").highcharts().getSelectedPoints(),
                point => {
                    point.select(false, false);
                }
            );
        }
    }
});
