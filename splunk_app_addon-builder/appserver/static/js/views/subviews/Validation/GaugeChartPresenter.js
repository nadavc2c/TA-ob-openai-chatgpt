import BaseSearchPresenter from "app/views/subviews/BaseSearchPresenter";
import Template from "contrib/text!./GaugeChartPresenter.html";
import "highcharts";
import "imports-loader?Highcharts=highcharts!lib/highcharts/highcharts-more";

export default BaseSearchPresenter.extend({
    template: Template,
    className: "ta-search-presenter ta-gauge-chart-presenter",
    initialize() {
        BaseSearchPresenter.prototype.initialize.apply(this, arguments);
    },
    render() {
        this.$el.html(this.compiledTemplate());
        return this;
    },
    events: {
        click: "onClick"
    },
    onDataChange(data) {
        let value;
        try {
            value = +data.rows[0][0];
            if (isNaN(value)) {
                value = -1;
            }
        } catch (err) {
            value = -1;
        }
        this.updateValue(value);
    },
    updateValue(val) {
        this.value = val;
        this.$el.addClass("is-interaction-enabled");
        let chartInstance = this.$(".ta-chart-container").highcharts();
        if (!chartInstance) {
            this.$(".ta-chart-container").empty().highcharts({
                title: {
                    text: null
                },
                chart: {
                    type: "gauge",
                    height: 250,
                    spacing: [0, 0, 0, 0]
                },
                pane: {
                    startAngle: -120,
                    endAngle: 120,
                    size: "95%",
                    background: {
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        innerWidth: 0
                    }
                },
                yAxis: {
                    min: 0,
                    max: 100,
                    plotBands: [
                        {
                            from: 0,
                            to: 70,
                            color: "#ff4f5a", // red
                            thickness: 15
                        },
                        {
                            from: 70,
                            to: 90,
                            color: "#ffd162", // yellow
                            thickness: 15
                        },
                        {
                            from: 90,
                            to: 100,
                            color: "#5dc05c", // green
                            thickness: 15
                        }
                    ],
                    tickColor: "#fff",
                    tickLength: 15,
                    minorTickColor: "#fff",
                    minorTickLength: 15
                },
                series: [
                    {
                        data: [val],
                        dataLabels: {
                            style: {
                                fontSize: "40px",
                                textShadow: "0 0 0"
                            },
                            y: 40,
                            borderWidth: 0,
                            formatter: function(format) {
                                if (this.y === -1) {
                                    return "-";
                                } else {
                                    if (this.y < 70) {
                                        format.color = "#ff4f5a";
                                    } else if (this.y < 90) {
                                        format.color = "#ffd162";
                                    } else {
                                        format.color = "#5dc05c";
                                    }
                                    return this.y;
                                }
                            }
                        }
                    }
                ],
                tooltip: {
                    enabled: false
                },
                credits: {
                    enabled: false
                }
            });
        } else {
            chartInstance.series[0].setData([val]);
        }
    },
    onClick(event) {
        if (!this.$el.hasClass("is-interaction-enabled")) {
            return;
        }
        event.preventDefault();
        this.trigger("click", this.options.value, this);
    },
    remove() {
        if (this.$(".ta-chart-container").highcharts()) {
            this.$(".ta-chart-container").highcharts().destroy();
        }
        BaseSearchPresenter.prototype.remove.apply(this);
    }
});
