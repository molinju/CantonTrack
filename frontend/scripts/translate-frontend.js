#!/usr/bin/env node
/**
 * translate-frontend.js
 * Usage: node frontend/scripts/translate-frontend.js [--dir=path/to/src]
 *
 * Recursively walks the given directory (default: frontend/src) and replaces
 * common Spanish strings with English equivalents. Creates a .bak backup for
 * any file modified.
 */

const fs = require('fs').promises;
const path = require('path');

const args = process.argv.slice(2);
const dirArg = args.find(a => a.startsWith('--dir='));
const ROOT_DIR = path.resolve(process.cwd(), dirArg ? dirArg.split('=')[1] : 'frontend/src');

const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.vue', '.css', '.scss', '.md'];

// Spanish -> English replacements (add more pairs as needed)
const REPLACEMENTS = [
  ['Iniciar sesión', 'Sign in'],
  ['Inicia sesión', 'Sign in'],
  ['Cerrar sesión', 'Sign out'],
  ['Cerrar sesion', 'Sign out'],
  ['Registrarse', 'Sign up'],
  ['Registro', 'Sign up'],
  ['Usuario', 'User'],
  ['Usuarios', 'Users'],
  ['Contraseña', 'Password'],
  ['Contrasena', 'Password'],
  ['Enviar', 'Submit'],
  ['Cancelar', 'Cancel'],
  ['Buscar', 'Search'],
  ['Cargando', 'Loading'],
  ['Cargando\.+', 'Loading'],
  ['Página no encontrada', 'Page not found'],
  ['Pagina no encontrada', 'Page not found'],
  ['Inicio', 'Home'],
  ['Perfil', 'Profile'],
  ['Guardar', 'Save'],
  ['Eliminar', 'Delete'],
  ['Borrar', 'Delete'],
  ['Sí', 'Yes'],
  ['Si', 'Yes'],
  ['No', 'No'],
  ['Aceptar', 'OK'],
  ['Rechazar', 'Decline'],
  ['Volver', 'Back'],
  ['Siguiente', 'Next'],
  ['Anterior', 'Previous'],
  ['Detalles', 'Details'],
  ['Error', 'Error'],
  ['Advertencia', 'Warning'],
  ['Información', 'Information'],
  ['Informacion', 'Information'],
  ['Contacto', 'Contact'],
  ['Ayuda', 'Help'],
  ['Nombre', 'Name'],
  ['Apellido', 'Last name'],
  ['Dirección', 'Address'],
  ['Direccion', 'Address'],
  ['Teléfono', 'Phone'],
  ['Telefono', 'Phone'],
  ['Guardar cambios', 'Save changes'],
  ['Cerrar', 'Close'],
  ['Ver', 'View'],
  ['Opciones', 'Options'],
  ['Seleccionar', 'Select']
];

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

async function walk(dir, fileList = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build'].includes(entry.name)) continue;
      await walk(full, fileList);
    } else if (entry.isFile()) {
      if (EXTENSIONS.includes(path.extname(entry.name))) fileList.push(full);
    }
  }
  return fileList;
}

async function processFile(file) {
  let content = await fs.readFile(file, 'utf8');
  let original = content;
  for (const [from, to] of REPLACEMENTS) {
    // If the pattern contains regex-like tokens (e.g. "+"), treat it as regex
    const useRegex = /[\\^$.*+?()[\]{}|]/.test(from);
    const re = useRegex ? new RegExp(from, 'g') : new RegExp(escapeForRegex(from), 'g');
    content = content.replace(re, to);
  }
  if (content !== original) {
    await fs.copyFile(file, file + '.bak');
    await fs.writeFile(file, content, 'utf8');
    console.log('Modified:', file);
    return true;
  }
  return false;
}

(async () => {
  try {
    const stat = await fs.stat(ROOT_DIR).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      console.error('Directory not found:', ROOT_DIR);
      process.exit(1);
    }
    const files = await walk(ROOT_DIR);
    let changed = 0;
    for (const f of files) {
      try {
        const r = await processFile(f);
        if (r) changed++;
      } catch (err) {
        console.error('Error processing', f, err.message);
      }
    }
    console.log(`Done. Files scanned: ${files.length}. Files changed: ${changed}.`);
  } catch (err) {
    console.error('Unhandled error:', err);
    process.exit(1);
  }
})();

