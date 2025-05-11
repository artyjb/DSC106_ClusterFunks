let fullData = [];

d3.csv("data/exam_data.csv", d => ({
  timestamp: +d.minutes_from_start,
  heart_rate: +d.HR,
  eda: +d.EDA,
  temperature: +d.TEMP,
  exam: d.exam.toLowerCase(),
  score: +d.score
})).then(data => {
  data.forEach(d => {
    if (d.score >= 85) d.group = "good";
    else if (d.score >= 70) d.group = "average";
    else d.group = "bad";
  });

  fullData = data;
  initControls();
  updateAllCharts();
});

function initControls() {
  d3.selectAll(".exam-btn").on("click", function () {
    d3.selectAll(".exam-btn").classed("selected", false);
    d3.select(this).classed("selected", true);
    updateAllCharts();
  });

  d3.selectAll(".performance-btn").on("click", function () {
    d3.selectAll(".performance-btn").classed("selected", false);
    d3.select(this).classed("selected", true);
    updateAllCharts();
  });
}

function updateAllCharts() {
  const examVal = d3.select(".exam-btn.selected").attr("data-value");
  const perfVal = d3.select(".performance-btn.selected").attr("data-value");

  const filtered = fullData.filter(d =>
    (examVal === "all" || d.exam === examVal) &&
    (perfVal === "all" || d.group === perfVal)
  );

  drawLineChart("#chart-temp", filtered, d => d.temperature, "Skin Temp (°C)");
  drawLineChart("#chart-eda", filtered, d => d.eda, "Skin Conductance (EDA)");
  drawLineChart("#chart-hr", filtered, d => d.heart_rate, "Heart Rate (BPM)");
}

function drawLineChart(container, data, valueFn, yLabel) {
  d3.select(container).html("");

  if (!data.length) {
    d3.select(container)
      .append("p")
      .text("No data for this selection.")
      .style("color", "#777")
      .style("padding", "40px 0");
    return;
  }

  const margin = { top: 40, right: 80, bottom: 50, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const series = d3.rollups(
    data,
    v => d3.mean(v, valueFn),
    d => d.exam,
    d => d.timestamp
  ).map(([exam, timeMap]) => ({
    exam,
    values: Array.from(timeMap, ([t, v]) => ({ timestamp: t, value: v }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }));

  const allTimes = series.flatMap(s => s.values.map(d => d.timestamp));
  const allValues = series.flatMap(s => s.values.map(d => d.value));
  const x = d3.scaleLinear().domain(d3.extent(allTimes)).nice().range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(allValues)).nice().range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));
  svg.append("g")
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("x", width / 2).attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text("Minutes from Start");
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2).attr("y", -45)
    .attr("text-anchor", "middle")
    .text(yLabel);
  svg.append("text")
    .attr("x", width / 2).attr("y", -15)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(yLabel + " Over Time by Exam");

  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(series.map(s => s.exam));
  const line = d3.line()
    .x(d => x(d.timestamp))
    .y(d => y(d.value));

  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  series.forEach(s => {
    const path = svg.append("path")
      .datum(s.values)
      .attr("fill", "none")
      .attr("stroke", color(s.exam))
      .attr("stroke-width", 2)
      .attr("d", line)
      .attr("id", `line-${s.exam}`);

    svg.selectAll(`.dot-${s.exam}`)
      .data(s.values)
      .enter()
      .append("circle")
      .attr("class", `dot-${s.exam}`)
      .attr("cx", d => x(d.timestamp))
      .attr("cy", d => y(d.value))
      .attr("r", 3)
      .attr("fill", color(s.exam))
      .on("mouseover", (e, d) => {
        tooltip.transition().duration(100).style("opacity", .9);
        tooltip.html(`
            <strong>Exam:</strong> ${s.exam}<br/>
            <strong>Min:</strong> ${d.timestamp}&#39;<br/>
            <strong>Val:</strong> ${d.value.toFixed(2)}
          `)
          .style("left", (e.pageX + 10) + "px")
          .style("top", (e.pageY - 30) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));
  });

  const legend = svg.append("g")
    .attr("transform", `translate(${width + 10},0)`);
  series.forEach((s, i) => {
    const g = legend.append("g")
      .attr("transform", `translate(0,${i * 25})`)
      .style("cursor", "pointer")
      .on("click", () => toggleSeries(s.exam));

    g.append("rect")
      .attr("width", 15).attr("height", 15)
      .attr("fill", color(s.exam));

    g.append("text")
      .attr("x", -5).attr("y", 12)
      .attr("text-anchor", "end")
      .text(s.exam.charAt(0).toUpperCase() + s.exam.slice(1));
  });

  function toggleSeries(ex) {
    const line = svg.select(`#line-${ex}`);
    const dots = svg.selectAll(`.dot-${ex}`);
    const visible = line.style("display") !== "none";
    line.style("display", visible ? "none" : null);
    dots.style("display", visible ? "none" : null);
  }
}
