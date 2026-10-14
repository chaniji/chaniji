.pragma library

// The day in two halves. Each half is one trip over the arc: the sun by day,
// the moon by night. Phase starts are minutes after midnight.
var halves = [
  { start: 6 * 60 + 30, end: 18 * 60, phases: [
    { name: "FOCUS", start: 6 * 60 + 30 },
    { name: "UNFOCUSED", start: 13 * 60 }
  ] },
  { start: 18 * 60, end: 6 * 60 + 30, phases: [
    { name: "DESIRE", start: 18 * 60 },
    { name: "SLEEP", start: 22 * 60 + 30 }
  ] }
]
var weekdays = ["ΚΥΡΙΑΚΗ", "ΔΕΥΤΕΡΑ", "ΤΡΙΤΗ", "ΤΕΤΑΡΤΗ", "ΠΕΜΠΤΗ", "ΠΑΡΑΣΚΕΥΗ", "ΣΑΒΒΑΤΟ"]

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes()
}

// Minutes from a to b, going forward over midnight when needed.
function span(a, b) {
  return (b - a + 1440) % 1440
}

function clockLabel(minutes) {
  function pad(n) { return n < 10 ? "0" + n : "" + n }
  return pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60)
}

// 0 = day half, 1 = night half.
function halfIndex(date) {
  var day = halves[0]
  return span(day.start, minutesOf(date)) < span(day.start, day.end) ? 0 : 1
}

// 0 at the start of the current half, 1 at its end.
function progress(date) {
  var half = halves[halfIndex(date)]
  return span(half.start, minutesOf(date)) / span(half.start, half.end)
}

function phaseName(date) {
  var half = halves[halfIndex(date)]
  var passed = span(half.start, minutesOf(date))
  var name = half.phases[0].name
  for (var i = 0; i < half.phases.length; i++) {
    if (span(half.start, half.phases[i].start) <= passed) name = half.phases[i].name
  }
  return name
}

// Layout of one half on the arc: end labels, and for each phase where it
// starts and where its middle is, as fractions 0..1 of the arc.
function halfLayout(index) {
  var half = halves[index]
  var length = span(half.start, half.end)
  var phases = []
  for (var i = 0; i < half.phases.length; i++) {
    var from = span(half.start, half.phases[i].start) / length
    var to = i + 1 < half.phases.length ? span(half.start, half.phases[i + 1].start) / length : 1
    phases.push({ name: half.phases[i].name, from: from, middle: (from + to) / 2 })
  }
  return { startLabel: clockLabel(half.start), endLabel: clockLabel(half.end), phases: phases }
}

function timeText(date) {
  function pad(n) { return n < 10 ? "0" + n : "" + n }
  return pad(date.getHours()) + ":" + pad(date.getMinutes())
}

function dateText(date) {
  return weekdays[date.getDay()] + "  " + date.getDate()
}

// Screen time: one number of active minutes per hour of the day.
function emptyDay() {
  var hours = []
  for (var i = 0; i < 24; i++) hours.push(0)
  return hours
}

function dateKey(date) {
  function pad(n) { return n < 10 ? "0" + n : "" + n }
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

// Bad or missing data becomes an empty day instead of an error.
function parseDay(raw) {
  var hours = emptyDay()
  try {
    var data = JSON.parse(raw)
    if (!Array.isArray(data)) return hours
    for (var i = 0; i < 24; i++) {
      var minutes = Math.round(Number(data[i]))
      if (minutes > 0) hours[i] = Math.min(60, minutes)
    }
  } catch (e) {}
  return hours
}

function total(hours) {
  var sum = 0
  for (var i = 0; i < hours.length; i++) sum += hours[i]
  return sum
}

function formatMinutes(minutes) {
  var h = Math.floor(minutes / 60)
  var m = minutes % 60
  if (h === 0) return m + "m"
  return h + "h " + (m < 10 ? "0" + m : m) + "m"
}
