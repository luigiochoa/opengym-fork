#!/usr/bin/env python3
"""Validate a private backup without extracting it or exposing its contents."""
import argparse, hashlib, json, pathlib, tarfile
p = argparse.ArgumentParser(); p.add_argument('archive', type=pathlib.Path); a = p.parse_args()
if a.archive.stat().st_mode & 0o077: raise SystemExit('Respaldo rechazado: usa permisos privados 0600.')
profiles = 0; files = 0; digest = hashlib.sha256(); db = None; has_secret = False
with tarfile.open(a.archive, 'r:gz') as archive:
    for member in archive:
        name = pathlib.PurePosixPath(member.name)
        if name.is_absolute() or '..' in name.parts or not name.parts or (name.parts[0] != 'data' and str(name) != '._data') or not (member.isdir() or member.isfile()):
            raise SystemExit('Respaldo rechazado: contiene una ruta o tipo de archivo inesperado.')
        if member.isdir(): continue
        files += 1; digest.update(member.name.encode())
        source = archive.extractfile(member)
        is_json = str(name) == 'data/db.json' or (name.parent == pathlib.PurePosixPath('data') and name.name.startswith('state-') and name.suffix == '.json')
        content = bytearray() if is_json else None
        while True:
            block = source.read(1048576)
            if not block: break
            digest.update(block)
            if content is not None: content.extend(block)
        if content is not None:
            document = json.loads(content)
            if not isinstance(document, dict): raise SystemExit('Respaldo rechazado: documento de datos no válido.')
            if str(name) == 'data/db.json': db = document
            else: profiles += 1
        if str(name) == 'data/secret': has_secret = True
if db is None or not isinstance(db.get('users'), list) or not has_secret: raise SystemExit('Respaldo incompleto: falta la base de usuarios o su clave de sesión.')
print(json.dumps({'valid': True, 'files': files, 'profileFiles': profiles, 'users': len(db['users']), 'sha256Content': digest.hexdigest(), 'archivePrivate': a.archive.stat().st_mode & 0o077 == 0}, indent=2))
