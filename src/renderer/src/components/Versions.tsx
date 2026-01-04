import { useState } from 'react'

function Versions(): React.JSX.Element {
  const [versions] = useState(
    window.electron?.process?.versions ?? { electron: 'N/A', chrome: 'N/A', node: 'N/A' }
  )

  return (
    <ul className="absolute bottom-8 flex items-center rounded-full bg-card/80 px-4 py-3 font-mono text-sm text-muted-foreground backdrop-blur">
      <li className="border-r border-border px-4">Electron v{versions.electron}</li>
      <li className="border-r border-border px-4">Chromium v{versions.chrome}</li>
      <li className="px-4">Node v{versions.node}</li>
    </ul>
  )
}

export default Versions
