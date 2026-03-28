import { StrictMode, Component, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error?: Error}> {
  constructor(props: {children: ReactNode}) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:40,textAlign:"center",fontFamily:"system-ui"}}>
          <h2 style={{color:"#7C3AED"}}>Story Sparks</h2>
          <p style={{color:"#DC2626",marginTop:16}}>Something went wrong. Please refresh the page.</p>
          <p style={{color:"#94A3B8",fontSize:12,marginTop:8}}>{this.state.error?.message}</p>
          <button onClick={()=>window.location.reload()} style={{marginTop:20,padding:"12px 24px",borderRadius:12,border:"none",background:"#7C3AED",color:"#fff",fontSize:16,cursor:"pointer"}}>
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
