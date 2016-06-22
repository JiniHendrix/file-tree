import EventEmitter from 'events'

import { Tree, WorkQueue, createAction, chokidarAdapter } from 'file-tree-common'

let initialId = 0
const getId = () => ++initialId

module.exports = class extends EventEmitter {

  get tree() {
    return this._tree
  }

  get transport() {
    return this._transport
  }

  get rootPath() {
    return this._rootPath
  }

  get metadata() {
    return this._tree.state.metadata
  }

  constructor(transport) {
    super()

    this._transport = transport

    this._emitEvent = this._emitAction.bind(this, "event")
    this._emitChange = this._emitAction.bind(this, "change")
    this._performAction = this._performAction.bind(this)
    this.startOperation = this.startOperation.bind(this)
    this.finishOperation = this.finishOperation.bind(this)

    this._requestMap = {}

    this._tree = new Tree()
    this._tree.on('change', this._emitChange)

    this._workQueue = new WorkQueue()
    this._workQueue.on('start', (taskCount) => {
      console.log('tasks =>', taskCount)
      this._tree.startTransaction()
    })
    this._workQueue.on('finish', this._tree.finishTransaction)

    this._actions = chokidarAdapter(this.tree)

    transport.on('message', this._performAction)
  }

  _performAction(action) {
    const {type, payload, error, meta} = action

    switch (type) {
      case 'initialState': {
        console.log('loading initial tree', tree)
        const {rootPath, state: {tree, stat}} = payload
        this.tree.set(rootPath, tree, stat)
        break
      }
      case 'batch': {
        console.log('executing batch =>', payload.length)
        this.tree.startTransaction()
        payload.forEach(this._performAction)
        this.tree.finishTransaction()
        break
      }
      case 'event': {
        const {name, path, stat} = payload
        const task = this._actions.bind(null, name, path, stat)
        console.log('task =>', name, path)
        this._workQueue.push(task)
        break
      }
      case 'response': {
        const {id} = meta
        if (error) {
          this._requestMap[id].reject(payload)
        } else {
          this._requestMap[id].resolve(payload)
        }
        break
      }
    }
  }

  startOperation() {
    this._tree.startTransaction()
  }

  finishOperation() {
    this._tree.finishTransaction()
  }

  updateNodeMetadata(path, field, value) {
    this._tree.setMetadataField(path, field, value)
  }

  run(methodName, ...args) {
    const {tree} = this
    const id = getId()

    switch (methodName) {
      case 'writeFile': {
        const [filePath] = args
        tree.addFile(filePath, { loading: true })
        break
      }
      case 'mkdir': {
        const [filePath] = args
        tree.addDir(filePath, { loading: true })
        break
      }
      case 'rename': {
        const [oldPath, newPath] = args
        tree.move(oldPath, newPath)
        break
      }
      case 'remove': {
        const [filePath] = args
        const node = tree.get(filePath)
        if (node) {
          if (node.type === 'directory') {
            tree.removeDir(filePath)
          } else {
            tree.removeFile(filePath)
          }
        }
        break
      }
    }

    this._transport.send({
      type: 'request',
      meta: { id },
      payload: {
        methodName,
        args,
      },
    })

    return new Promise((resolve, reject) => {
      this._requestMap[id] = {resolve, reject}
    })
  }

  watchPath(path) {
    this._transport.send({
      type: 'watchPath',
      payload: { path },
    })
  }

  _emitAction(type, ...args) {
    const action = createAction(type, ...args)
    this.emit(type, action)
  }
}
