import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { CanvasElement, Background, CanvasState } from '../../types/canvas'

const defaultBackground: Background = {
  type: 'solid',
  solid: { color: '#ffffff', opacity: 100 },
}

const initialState: CanvasState = {
  elements: [],
  selectedElementId: null,
  background: defaultBackground,
  width: 1920,
  height: 1080,
  zoom: 50,
  history: [{ elements: [], background: defaultBackground }],
  historyIndex: 0,
}

const pushHistory = (state: CanvasState) => {
  const snapshot = { elements: JSON.parse(JSON.stringify(state.elements)), background: JSON.parse(JSON.stringify(state.background)) }
  state.history = state.history.slice(0, state.historyIndex + 1)
  state.history.push(snapshot)
  if (state.history.length > 50) state.history.shift()
  state.historyIndex = state.history.length - 1
}

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    loadProject(state, action: PayloadAction<{ elements: CanvasElement[]; background: Background; width: number; height: number }>) {
      state.elements = action.payload.elements || []
      state.background = action.payload.background || defaultBackground
      state.width = action.payload.width
      state.height = action.payload.height
      state.history = [{ elements: JSON.parse(JSON.stringify(state.elements)), background: JSON.parse(JSON.stringify(state.background)) }]
      state.historyIndex = 0
    },
    addElement(state, action: PayloadAction<CanvasElement>) {
      state.elements.push(action.payload)
      state.selectedElementId = action.payload.id
      pushHistory(state)
    },
    updateElement(state, action: PayloadAction<{ id: string; updates: Partial<CanvasElement> }>) {
      const idx = state.elements.findIndex(e => e.id === action.payload.id)
      if (idx !== -1) {
        state.elements[idx] = { ...state.elements[idx], ...action.payload.updates }
      }
    },
    commitUpdate(state) {
      pushHistory(state)
    },
    deleteElement(state, action: PayloadAction<string>) {
      state.elements = state.elements.filter(e => e.id !== action.payload)
      state.selectedElementId = null
      pushHistory(state)
    },
    selectElement(state, action: PayloadAction<string | null>) {
      state.selectedElementId = action.payload
    },
    updateBackground(state, action: PayloadAction<Background>) {
      state.background = action.payload
      pushHistory(state)
    },
    setCanvasSize(state, action: PayloadAction<{ width: number; height: number }>) {
      state.width = action.payload.width
      state.height = action.payload.height
    },
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = action.payload
    },
    undo(state) {
      if (state.historyIndex > 0) {
        state.historyIndex--
        const snap = state.history[state.historyIndex]
        state.elements = JSON.parse(JSON.stringify(snap.elements))
        state.background = JSON.parse(JSON.stringify(snap.background))
        state.selectedElementId = null
      }
    },
    redo(state) {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++
        const snap = state.history[state.historyIndex]
        state.elements = JSON.parse(JSON.stringify(snap.elements))
        state.background = JSON.parse(JSON.stringify(snap.background))
        state.selectedElementId = null
      }
    },
    bringForward(state, action: PayloadAction<string>) {
      const el = state.elements.find(e => e.id === action.payload)
      if (el) { el.zIndex = Math.min(el.zIndex + 1, 999) }
    },
    sendBackward(state, action: PayloadAction<string>) {
      const el = state.elements.find(e => e.id === action.payload)
      if (el) { el.zIndex = Math.max(el.zIndex - 1, 0) }
    },
    toggleLock(state, action: PayloadAction<string>) {
      const el = state.elements.find(e => e.id === action.payload)
      if (el) el.locked = !el.locked
    },
    toggleVisibility(state, action: PayloadAction<string>) {
      const el = state.elements.find(e => e.id === action.payload)
      if (el) el.visible = !el.visible
    },
    duplicateElement(state, action: PayloadAction<string>) {
      const el = state.elements.find(e => e.id === action.payload)
      if (el) {
        const clone = JSON.parse(JSON.stringify(el))
        clone.id = Date.now().toString()
        clone.x += 20
        clone.y += 20
        clone.zIndex = Math.max(...state.elements.map(e => e.zIndex), 0) + 1
        state.elements.push(clone)
        state.selectedElementId = clone.id
        pushHistory(state)
      }
    },
  },
})

export const {
  loadProject, addElement, updateElement, commitUpdate, deleteElement,
  selectElement, updateBackground, setCanvasSize, setZoom,
  undo, redo, bringForward, sendBackward, toggleLock, toggleVisibility, duplicateElement
} = canvasSlice.actions
export default canvasSlice.reducer
