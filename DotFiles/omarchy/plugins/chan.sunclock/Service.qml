import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import "Model.js" as Model

Item {
  id: root

  // Injected by omarchy-shell (the service loader).
  property var shell: null

  readonly property date now: clock.date
  readonly property int halfIndex: Model.halfIndex(now)
  readonly property bool day: halfIndex === 0
  readonly property real progress: Model.progress(now)
  readonly property string phase: Model.phaseName(now)
  readonly property var layout: Model.halfLayout(halfIndex)

  // Screen time today: minutes the user was active (not idle, not locked).
  readonly property string stateDir: Quickshell.env("HOME") + "/.local/state/chan-screentime"
  // Same as the screensaver timeout: after this long without input, time stops counting.
  readonly property int idleTimeoutSeconds: 150
  property string screenDay: Model.dateKey(new Date())
  property var screenHours: Model.emptyDay()
  property bool screenLoaded: false
  readonly property int screenMinutes: Model.total(screenHours)

  function addScreenMinute() {
    var date = new Date()
    var today = Model.dateKey(date)
    if (today !== root.screenDay) {
      root.screenLoaded = true
      root.screenHours = Model.emptyDay()
      root.screenDay = today
    }
    if (!root.screenLoaded) return
    var next = root.screenHours.slice()
    next[date.getHours()] = Math.min(60, next[date.getHours()] + 1)
    root.screenHours = next
    screenFile.setText(JSON.stringify(next))
  }

  SystemClock {
    id: clock
    precision: SystemClock.Minutes
  }

  IdleMonitor {
    id: idleMonitor
    enabled: true
    timeout: root.idleTimeoutSeconds
    respectInhibitors: true
  }

  Timer {
    interval: 60000
    repeat: true
    running: true
    onTriggered: if (!idleMonitor.isIdle && !lockCheck.running) lockCheck.running = true
  }

  Process {
    id: lockCheck
    command: ["omarchy-shell", "lock", "isLocked"]
    stdout: StdioCollector {
      onStreamFinished: if (text.trim() !== "true") root.addScreenMinute()
    }
  }

  FileView {
    id: screenFile
    path: root.stateDir + "/" + root.screenDay + ".json"
    printErrors: false
    onLoaded: {
      if (root.screenLoaded) return
      root.screenHours = Model.parseDay(text())
      root.screenLoaded = true
    }
    onLoadFailed: root.screenLoaded = true
  }

  Variants {
    model: Quickshell.screens

    PanelWindow {
      id: card
      required property var modelData

      readonly property real centerX: width / 2
      readonly property real horizonY: 100
      readonly property real arcRadius: 72
      // Dim text is a solid mix of the two theme colors, not a see-through
      // color, so it does not get weaker on a bright wallpaper.
      readonly property color dim: Qt.tint(Color.background, Util.alpha(Color.foreground, 0.6))
      readonly property color dimmer: Qt.tint(Color.background, Util.alpha(Color.foreground, 0.5))

      screen: modelData
      color: "transparent"
      implicitWidth: 240
      implicitHeight: 214
      exclusionMode: ExclusionMode.Ignore
      WlrLayershell.layer: WlrLayer.Bottom
      WlrLayershell.namespace: "chan-sunclock"
      anchors { right: true; bottom: true }
      margins { right: 36; bottom: 30 }

      Canvas {
        id: sky
        anchors.fill: parent

        readonly property color ink: Color.foreground
        // Everything gets an edge in this color, so it reads on any wallpaper.
        readonly property color paper: Color.background
        readonly property real progress: root.progress
        readonly property bool day: root.day

        onInkChanged: requestPaint()
        onPaperChanged: requestPaint()
        onProgressChanged: requestPaint()
        onDayChanged: requestPaint()

        Connections {
          target: root
          function onLayoutChanged() { sky.requestPaint() }
        }

        onPaint: {
          var ctx = getContext("2d")
          ctx.reset()
          var cx = card.centerX, cy = card.horizonY, r = card.arcRadius

          var angle = Math.PI * (1 - progress)
          var x = cx + r * Math.cos(angle)
          var y = cy - r * Math.sin(angle)

          // Two passes: first a slightly thicker edge in the paper color, then
          // the drawing itself on top.
          for (var pass = 0; pass < 2; pass++) {
            var edge = pass === 0
            var grow = edge ? 1 : 0
            var shade = function(strength) {
              return edge ? paper : Qt.tint(paper, Util.alpha(ink, strength))
            }

            // Horizon.
            ctx.strokeStyle = shade(0.5)
            ctx.lineWidth = 1 + grow * 2
            ctx.beginPath()
            ctx.moveTo(cx - r - 12 - grow, cy + 0.5)
            ctx.lineTo(cx + r + 12 + grow, cy + 0.5)
            ctx.stroke()

            // Path: one dot per half hour, brighter where the sun or moon has been.
            for (var i = 0; i <= 24; i++) {
              var f = i / 24
              var a = Math.PI * (1 - f)
              ctx.fillStyle = shade(f <= progress ? 0.8 : 0.4)
              ctx.beginPath()
              ctx.arc(cx + r * Math.cos(a), cy - r * Math.sin(a), 1 + grow, 0, Math.PI * 2)
              ctx.fill()
            }

            // Tick where one phase ends and the next starts.
            ctx.strokeStyle = shade(0.7)
            ctx.lineWidth = 1 + grow * 2
            for (var p = 1; p < root.layout.phases.length; p++) {
              var tick = Math.PI * (1 - root.layout.phases[p].from)
              ctx.beginPath()
              ctx.moveTo(cx + (r - 5 - grow) * Math.cos(tick), cy - (r - 5 - grow) * Math.sin(tick))
              ctx.lineTo(cx + (r + 5 + grow) * Math.cos(tick), cy - (r + 5 + grow) * Math.sin(tick))
              ctx.stroke()
            }

            ctx.fillStyle = shade(1)
            ctx.strokeStyle = shade(1)
            if (day) {
              // Sun: disc with eight short rays.
              ctx.beginPath()
              ctx.arc(x, y, 5 + grow, 0, Math.PI * 2)
              ctx.fill()
              ctx.lineWidth = 1.5 + grow * 2
              for (var k = 0; k < 8; k++) {
                var ray = k * Math.PI / 4
                ctx.beginPath()
                ctx.moveTo(x + (8 - grow) * Math.cos(ray), y + (8 - grow) * Math.sin(ray))
                ctx.lineTo(x + (11 + grow) * Math.cos(ray), y + (11 + grow) * Math.sin(ray))
                ctx.stroke()
              }
            } else {
              // Moon: disc. The bite is cut out after both passes.
              ctx.beginPath()
              ctx.arc(x, y, 6 + grow, 0, Math.PI * 2)
              ctx.fill()
            }
          }

          if (!day) {
            ctx.globalCompositeOperation = "destination-out"
            ctx.beginPath()
            ctx.arc(x + 4, y - 3, 6, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalCompositeOperation = "source-over"
          }
        }
      }

      // Phase names above their part of the arc. The current one is bright.
      Repeater {
        model: root.layout.phases

        Text {
          required property var modelData
          readonly property real angle: Math.PI * (1 - modelData.middle)

          x: Math.round(card.centerX + (card.arcRadius + 14) * Math.cos(angle) - width / 2)
          y: Math.round(card.horizonY - (card.arcRadius + 14) * Math.sin(angle) - height / 2)
          text: modelData.name
          color: modelData.name === root.phase ? Color.foreground : card.dimmer
          style: Text.Outline
          styleColor: Color.background
          font.family: Style.fontFamily
          font.pixelSize: 9
          font.letterSpacing: 1
        }
      }

      // Clock time at each end of the arc.
      Text {
        x: Math.round(card.centerX - card.arcRadius - width / 2)
        y: card.horizonY + 5
        text: root.layout.startLabel
        color: card.dim
        style: Text.Outline
        styleColor: Color.background
        font.family: Style.fontFamily
        font.pixelSize: 9
      }

      Text {
        x: Math.round(card.centerX + card.arcRadius - width / 2)
        y: card.horizonY + 5
        text: root.layout.endLabel
        color: card.dim
        style: Text.Outline
        styleColor: Color.background
        font.family: Style.fontFamily
        font.pixelSize: 9
      }

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        y: card.horizonY + 8
        text: Model.timeText(root.now)
        color: Color.foreground
        style: Text.Outline
        styleColor: Color.background
        font.family: Style.fontFamily
        font.pixelSize: 28
        font.weight: Font.Bold
      }

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        y: card.horizonY + 46
        text: root.phase
        color: Color.foreground
        style: Text.Outline
        styleColor: Color.background
        font.family: Style.fontFamily
        font.pixelSize: 11
        font.weight: Font.Bold
        font.letterSpacing: 2
      }

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        y: card.horizonY + 66
        text: Model.dateText(root.now)
        color: card.dim
        style: Text.Outline
        styleColor: Color.background
        font.family: Style.fontFamily
        font.pixelSize: 10
        font.letterSpacing: 2
      }

      Text {
        anchors.horizontalCenter: parent.horizontalCenter
        y: card.horizonY + 84
        text: "SCREEN  " + Model.formatMinutes(root.screenMinutes)
        color: card.dim
        style: Text.Outline
        styleColor: Color.background
        font.family: Style.fontFamily
        font.pixelSize: 10
        font.letterSpacing: 2
      }
    }
  }
}
