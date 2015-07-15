var _ = require('lodash');
var d3 = require('d3');

var ChartStore = require('stores/ChartStore');

var DEFAULT_TRANSITION_MS = 1000;

module.exports = class PercentValueScatter {
  constructor(svgSelector='svg', opts={}) {
    var svg = this.svg = d3.select(svgSelector);

    if (!svg[0][0])
      throw new Error('Invalid svg specified');

    this.opts = opts = _.defaults(opts, {
      margin: {
        left: 60,
        right: 10,
        bottom: 20,
        top: 10
      }
    });

    // margin convention: http://bl.ocks.org/mbostock/3019563
    svg = svg.append('g')
      .attr('transform', 'translate(' + opts.margin.left + ', ' + opts.margin.top + ')');

    var svgW = parseInt(this.svg.attr('width'), 10);
    var svgH = parseInt(this.svg.attr('height'), 10);

    if (!svgW || !svgH)
      throw new Error('Invalid svg specified -- must have w and h');

    this.opts.chartArea = _.defaults(opts.chartArea || {}, {
      width: svgW - opts.margin.left - opts.margin.right,
      height: svgH - opts.margin.top - opts.margin.bottom
    });

    this._components = {
      xScale: d3.scale.linear().range([0, opts.chartArea.width]),
      xAxis: d3.svg.axis().tickSize(3).tickPadding(6).orient('bottom'),

      yScale: d3.scale.linear().range([opts.chartArea.height, 0]),
      yAxis: d3.svg.axis().tickSize(3).tickPadding(6).orient('left'),
    };

    this._svg = {
      xAxis: svg.append('g').classed('x axis', true)
        .attr('transform', 'translate(0, ' + opts.chartArea.height + ')'),

      yAxis: svg.append('g').classed('y axis', true),

      chartArea: svg.append('g').classed('chart-canvas', true)
    };

    ChartStore.on('percentValueScatterData', this.handleData.bind(this));
  }

  handleData(chartConfig) {
    this._data = chartConfig;
    this._renderXAxis(chartConfig.axes.percentage);
    this._renderYAxis(chartConfig.axes.value);
    this._renderData(chartConfig.series);
  }

  _renderData(series) {

    var xScale = this._components.xScale;
    var yScale = this._components.yScale;

    var lineGeneratorActual = window.hdLineGen = d3.svg.line()
      .x(d => xScale(d.percentage))
      .y(d => yScale(d.value));

    var lineGenerator = function(serie) {
      var nonNullPoints = serie.data.filter(tuple => tuple.percentage !== null);
      return lineGeneratorActual(nonNullPoints);
    };


    var seriesG = this._svg.chartArea.selectAll('g')
      .data(series, d => '' + d.stake.id);

    seriesG.enter().append('g')
      .classed('series', true)
      .attr('data-stake', d => d.stake.name)
    // for new series, create the paths:
    .append('path')
      .attr({
        'd': d => lineGenerator( d ),
        'fill': 'none',
        'stroke': d => d.color,
        'stroke-width': '2px',
        'opacity': 0
      });


    // for existing one, just update their positions
    seriesG.selectAll('path')
    .transition()
      .duration(DEFAULT_TRANSITION_MS)
    .attr({
      'd': function(d) {
        // when updating existing paths, the data is stale (it was copied over from the append).
        // Grab the latest data from the parent element.
        return lineGenerator( d3.select(this.parentElement).datum() );
      },
      'stroke': d => d.color, // note: color may change as rounds are added
      'opacity': 1
    });

    seriesG.exit()
    .transition()
      .duration(DEFAULT_TRANSITION_MS)
    .attr('opacity', 0)
    .remove();
  }

  _renderXAxis(xAxisConfig) {
    this._components.xScale
    .domain( xAxisConfig.domain.slice().reverse() )
    .nice(5);

    this._components.xAxis
    .scale( this._components.xScale )
    .tickFormat(xAxisConfig.formatter)
    .ticks(5);

    this._svg.xAxis.transition().duration(DEFAULT_TRANSITION_MS).call( this._components.xAxis );
  }

  _renderYAxis(yAxisConfig) {
    this._components.yScale
    .domain( yAxisConfig.domain )
    .nice(5);

    this._components.yAxis
    .scale( this._components.yScale )
    .tickFormat(yAxisConfig.formatter)
    .ticks(5);

    this._svg.yAxis.transition().duration(DEFAULT_TRANSITION_MS).call( this._components.yAxis );
  }
};
