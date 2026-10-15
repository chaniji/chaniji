import QtQuick
import Quickshell.Io
import qs.Ui

BarWidget {
  id: root
  moduleName: "chan.menustrip"

  // Root groups of the Omarchy menu, in menu order.
  readonly property var groups: [
    { id: "apps", label: "Apps" },
    { id: "omarchy", label: "Omarchy" },
    { id: "packages", label: "Packages" },
    { id: "about", label: "About" },
    { id: "system", label: "System" }
  ]

  // Screen boxes of every word, so the menu can draw its highlight on them.
  function wordBoxes() {
    var out = []
    for (var i = 0; i < words.count; i++) {
      var item = words.itemAt(i)
      var pos = item.mapToItem(null, 0, 0)
      out.push({ id: groups[i].id, x: Math.round(pos.x), y: Math.round(pos.y), w: Math.round(item.width), h: Math.round(item.height) })
    }
    return out
  }

  function openMenu(payload) {
    if (!root.bar) return
    payload.words = root.wordBoxes()
    root.bar.run("omarchy-shell shell toggle chan.menu '" + JSON.stringify(payload) + "'")
  }

  // Super+Space: highlight the first word, no popup.
  IpcHandler {
    target: "chan.menustrip"
    function focus(): void { root.openMenu({ strip: true, index: 0 }) }
  }

  implicitWidth: strip.implicitWidth
  implicitHeight: strip.implicitHeight

  Row {
    id: strip
    anchors.fill: parent

    Repeater {
      id: words
      model: root.groups

      WidgetButton {
        required property var modelData
        bar: root.bar
        text: modelData.label
        horizontalMargin: 6
        required property int index
        onPressed: function(button) {
          // The bar window starts at the screen's left edge, so this is the
          // screen x the dropdown lines up with.
          var x = Math.round(mapToItem(null, 0, 0).x)
          root.openMenu({ menu: modelData.id, anchorX: x, dropdown: true, index: index })
        }
      }
    }
  }
}
