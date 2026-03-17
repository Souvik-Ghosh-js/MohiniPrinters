import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import canvasReducer from './slices/canvasSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    canvas: canvasReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export default store
