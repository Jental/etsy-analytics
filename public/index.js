const availableWidth = window.innerWidth
      || document.documentElement.clientWidth
      || document.body.clientWidth;

const availableHeight = window.innerHeight
      || document.documentElement.clientHeight
      || document.body.clientHeight;

const legendWidth = 0;//400;
const pageSize = 65;

// set the dimensions and margins of the graph
const margin = {top: 10, right: 30, bottom: 30, left: 60};
const width = availableWidth - margin.left - margin.right - 40 - legendWidth;
const height = 100;// availableHeight - margin.top - margin.bottom - 100;

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = function() {
    resolve(reader.result);
  };
  reader.onerror = function() {
    reject(reader.error);
  };

  reader.readAsText(file);
});

const prepareData = (original) => {
  const minTimespamp = _.minBy(original, 'timestamp').timestamp;
  const maxTimestamp = _.maxBy(original, 'timestamp').timestamp;

  const result = _
        .chain(original)
        .map(d => d.entries.map(e => ({
          timestamp: d.timestamp,
          tag: d.tag,
          name: e[0],
          position: e[1] + e[2] / pageSize,
          page: e[1],
          positionOnPage: e[2]
          
        })))
        .flatten()
        .groupBy('name')
        .map((es, name) => ({
          name: name,
          entries: es
        }))
        .value();

  const maxPosition = _
        .chain(result)
        .flatMap(r => r.entries)
        .maxBy('position')
        .value()
        .position;
  const minPosition = _
        .chain(result)
        .flatMap(r => r.entries)
        .minBy('position')
        .value()
        .position;

  return {result, minTimespamp, maxTimestamp, maxPosition, minPosition};
};

// data: [{ timestamp, position, page, positionOnPage }]
const drawSingle = (name, data, colors) => {
  console.log('drawSingle: name:', name);
  console.log('drawSingle: data:', data);
  const minTimestamp = _.minBy(data, 'timestamp').timestamp;
  const maxTimestamp = _.maxBy(data, 'timestamp').timestamp;
  const minPosition = _.minBy(data, 'position').position;
  const maxPosition = _.maxBy(data, 'position').position;

  const container = document.getElementById("my_dataviz");
  const newHeader = document.createElement('h3');
  newHeader.innerHTML = name;
  newHeader.style = "color: cadetblue;";
  container.append(newHeader);
  
  // append the svg object to the body of the page
  const svg =
        d3.select("#my_dataviz")
        .append("svg")
        .attr("width", width + margin.left + margin.right + legendWidth)
        .attr("height", height + margin.top + margin.bottom + 65)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis
  const x =
        d3.scaleTime()
        .domain([minTimestamp, maxTimestamp])
        .range([ 0, width ]);
  const xTickValues = data.map(e => e.timestamp);
  const xAxis =
        d3.axisBottom(x)
        .tickValues(xTickValues)
        .tickFormat(d => { const date = new Date(d); return moment(d).format('YYYY.MM.DD HH:mm'); });
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis)
    .selectAll("text")  
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", "-.5em")
    .attr("transform", "rotate(-90)");

  // Add Y axis
  const y =
        d3.scaleLinear()
        .domain([minPosition, maxPosition])
        .range([height, 0]);
  const yTickValues = _.uniq(data.map(e => e.position));
  const yAxis =
        d3.axisLeft(y)
        .tickValues(yTickValues)
        .tickFormat(d => `${Math.floor(d)} - ${Math.round((d - Math.floor(d)) * pageSize)}`);
  svg
    .append("g")
    .call(yAxis);

  // Draw lines
  svg
    .datum(data)
    .append("path")
    .attr("fill", "none")
    .attr("stroke", colors(name))
    .attr("stroke-width", 1.5)
    .attr(
      "d",
      d3.line()
        .x(d =>  x(d.timestamp))
        .y(d => y(d.position))
    );

  svg
    .selectAll(".point")
    .data(data)
    .enter()
    .append("svg:circle")
    .attr("stroke", "black")
    .attr("fill", colors(name))
    .attr("cx", d => x(d.timestamp))
    .attr("cy", d => y(d.position))
    .attr("r", () => 3);
};

const draw = async (files) => {
  console.log('draw', files);

  const data = await Promise.all(Array.from(files).map(async (f) => ({
    name: f.name,
    data: await readFile(f)
  })));
  for (let d of data) {
    try {
      d.data = JSON.parse('[' + d.data + ']');
    }
    catch(e) {
      console.error(e);
      d.data = null;
    }
  }

  d3.selectAll("svg > g > *").remove();
  d3.selectAll("#my_dataviz > *").remove();

  const presult = prepareData(data[0].data);
  console.log(presult);
  const dataToDraw = presult.result;

  // Color palette
  var names = dataToDraw.map(d => d.name );
  var colors =
      d3.scaleOrdinal()
      .domain(names)
      .range(['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999']);

  for (let data of dataToDraw) {
    drawSingle(data.name, data.entries, colors);
  }
};

  // // Legend
  // dataToDraw.forEach((d0, i) => {
  //   console.log(d0, i);
  //   var legend = svg.append("g")
  //       .attr("class", "legend")
  //       .attr("x", width + 30)
  //       .attr("y", 25 * (i + 1))
  //       .attr("height", 100)
  //       .attr("width", legendWidth - 10);

  //   legend
  //     .append("rect")
  //     .attr("x", width + 10)
  //     .attr("y", 25 * (i + 1) - 10)
  //     .attr("width", 10)
  //     .attr("height", 10)
  //     .style("fill", color(d0.name));

  //   legend
  //     .append("text")
  //     .attr("x", width + 30)
  //     .attr("y", 25 * (i + 1))
  //     .text(d0.name);
  // });
