var ipc = require('electron').ipcRenderer
var frame = require('web-frame')
var insertCss = require('insert-css')

var fs = require('fs')
var join = require('path').join

var Observ = require('observ')
var Property = require('observ-default')
var watch = require('observ/watch')
var FileObject = require('lib/file-object')

var VirtualDom = require('virtual-dom')
var MainLoop = require('main-loop')
var noDrop = require('lib/no-drop')
var applyKeyboardTempo = require('lib/keyboard-tempo')
var renderNode = require('lib/render-node')

var MidiStream = require('web-midi')
var PeriodicWaves = require('lib/periodic-waves')

// apply css styles
insertCss(require('./styles'))
frame.setZoomLevelLimits(1, 1)

// midi ports
var midiPorts = Observ()
midiPorts.open = MidiStream
midiPorts.openInput = MidiStream.openInput
midiPorts.openOutput = MidiStream.openOutput

MidiStream.watchPortNames(function (ports) {
  midiPorts.set(ports)
})

// create root context
var audioContext = new global.AudioContext()
var nodes = require('./nodes')
var rootContext = window.rootContext = {
  fs: fs,
  audio: audioContext,
  periodicWaves: PeriodicWaves(audioContext),
  midiPorts: midiPorts,
  nodes: nodes.objectLookup,
  nodeInfo: nodes,
  zoom: Property(1.1)
}

watch(rootContext.zoom, function (value) {
  frame.setZoomFactor(value || 1)
})

noDrop(document)
require('lib/context-menu')

document.addEventListener('DOMContentLoaded', function (event) {
  ipc.send('loaded')
})

ipc.on('load-project', function (e, path) {
  // load project and initialize view

  var projectPath = join(path, 'project.json')
  var projectFile = FileObject(rootContext)

  projectFile.onLoad(function () {
    document.body.appendChild(createRootElement(projectFile.node))
    window.currentProject = projectFile.node
  })

  ensureProject(projectPath, function (err) {
    if (err) throw err
    projectFile.load(projectPath)
  })
})

function createRootElement (project) {
  var renderer = MainLoop(project, renderNode, VirtualDom)

  project(update)
  project.resolved(update)
  applyKeyboardTempo(project)

  return renderer.target

  // scoped

  function update () {
    // render!
    renderer.update(project)
  }
}

function ensureProject (path, cb) {
  rootContext.fs.exists(path, function (exists) {
    if (exists) {
      cb()
    } else {
      rootContext.fs.writeFile(path, JSON.stringify({
        node: 'project'
      }), cb)
    }
  })
}
