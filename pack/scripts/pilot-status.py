#!/usr/bin/env python3
"""Read-only operational report. Never prints identities, secrets or user records."""
import argparse, datetime, json, pathlib, shutil, sys, urllib.request
p = argparse.ArgumentParser()
p.add_argument('url', help='HTTPS URL of the pilot, or its loopback health URL')
p.add_argument('--data-dir', type=pathlib.Path)
p.add_argument('--backup-dir', type=pathlib.Path)
a = p.parse_args(); result = {'checks': {}, 'warnings': []}
base = a.url.rstrip('/')
for route in ['health', 'config']:
    try:
        with urllib.request.urlopen(base + '/api/' + route, timeout=10) as response:
            data = json.loads(response.read(65536))
        result['checks'][route] = {'reachable': True}
        if route == 'config':
            result['checks'][route]['trainerPilot'] = data.get('trainer_pilot') is True
            if data.get('trainer_pilot') is not True: result['warnings'].append('La gestión del piloto no está activada.')
    except Exception as error:
        result['checks'][route] = {'reachable': False, 'error': type(error).__name__}
if a.data_dir:
    free = shutil.disk_usage(a.data_dir).free
    result['checks']['storage'] = {'freeMiB': round(free / 1048576), 'dbPresent': (a.data_dir / 'db.json').is_file()}
    if free < 1073741824: result['warnings'].append('Menos de 1 GiB disponible para datos y respaldos.')
if a.backup_dir:
    archives = list(a.backup_dir.glob('*-data-*.tar.gz'))
    age = (datetime.datetime.now().timestamp() - max(f.stat().st_mtime for f in archives)) / 3600 if archives else None
    result['checks']['backup'] = {'archives': len(archives), 'latestAgeHours': round(age, 1) if age is not None else None}
    if age is None or age > 48: result['warnings'].append('No hay un respaldo local reciente; comprobar también la copia externa.')
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if all(c.get('reachable', True) for c in result['checks'].values()) and not result['warnings'] else 1)
