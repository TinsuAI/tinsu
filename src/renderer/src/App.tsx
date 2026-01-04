import Versions from './components/Versions'
import { Button } from './components/ui/button'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <img alt="logo" className="mb-5 h-32 w-32" src={electronLogo} />
      <div className="mb-2 text-sm font-semibold text-muted-foreground">Powered by electron-vite</div>
      <div className="mb-4 text-center text-2xl font-bold">
        Build an Electron app with <span className="text-sky-400">React</span>
        &nbsp;and <span className="text-blue-400">TypeScript</span>
      </div>
      <p className="text-muted-foreground">
        Please try pressing <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">F12</code> to open the devTool
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild variant="default">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </Button>
        <Button variant="secondary">Get Started</Button>
      </div>
      <Versions />
    </div>
  )
}

export default App
