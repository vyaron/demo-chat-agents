import fs from "fs"
import path from "path"

const frontendDist = path.resolve(process.cwd(), "../frontend/dist")
const targetDir = path.resolve(process.cwd(), "dist/public")

if (!fs.existsSync(frontendDist)) {
  throw new Error(`Frontend build output not found at ${frontendDist}`)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.mkdirSync(targetDir, { recursive: true })
fs.cpSync(frontendDist, targetDir, { recursive: true })

console.log(`Copied frontend dist from ${frontendDist} to ${targetDir}`)
