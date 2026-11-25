// Un solo comando para la entrega: reglas → estática → tests → build → espejo.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function correr(comando, args) {
  console.log(`\n$ ${comando} ${args.join(' ')}`)
  execFileSync(comando, args, { stdio: 'inherit', shell: process.platform === 'win32' })
}

correr('npm', ['run', 'check:api'])
correr('npm', ['run', 'check:reglas'])
correr('npm', ['test'])
correr('npm', ['run', 'build'])

const espejo = '/mnt/c/xampp/htdocs/3a1-api'
if (existsSync(espejo)) {
  console.log(`\n$ diff -rq api ${espejo}`)
  execFileSync('diff', ['-rq', 'api', espejo], { stdio: 'inherit' })
  console.log('\nverify OK: frontend, motor y espejo del backend sincronizados.')
} else {
  console.log('\nverify OK (frontend y motor). Espejo no disponible en esta máquina.')
}
