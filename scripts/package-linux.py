"""Package Linux source with offline universal wheels and Unix file modes; no cross compilation."""
import gzip
import hashlib
from pathlib import Path
import sys
import tarfile

root = Path(__file__).resolve().parent.parent
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'FlowLab-0.3-Linux.tar.gz'
if root in destination.parents:
    raise SystemExit('El archivo de salida debe quedar fuera del directorio fuente.')
excluded = {'__pycache__', '.git', '.venv', '.venv-linux', 'work', 'node_modules'}
files = [p for p in sorted(root.rglob('*')) if p.is_file()
         and not any(part in excluded for part in p.relative_to(root).parts) and p.suffix != '.pyc']
required = ['instalar-linux.sh', 'start.sh', 'requirements-offline.txt', 'docs/LINUX.md',
            'scripts/build-linux.sh', 'firmware/FlowLabBridge/burst.h', 'web/transports.mjs']
for name in required:
    assert (root / name).is_file(), name
assert len(list((root / 'vendor/wheels').glob('*none-any.whl'))) == 2
destination.parent.mkdir(parents=True, exist_ok=True)
with destination.open('wb') as output:
    with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for path in files:
                if path.is_symlink():
                    raise ValueError('No se empaquetan enlaces: ' + str(path))
                info = archive.gettarinfo(str(path), arcname='FlowLab/' + path.relative_to(root).as_posix())
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                info.mtime = 0
                info.mode = 0o755 if path.suffix == '.sh' else 0o644
                with path.open('rb') as content:
                    archive.addfile(info, content)
with tarfile.open(destination, 'r:gz') as archive:
    for name in required:
        archive.getmember('FlowLab/' + name)
    for member in archive.getmembers():
        assert member.isfile() and member.name.startswith('FlowLab/')
        if member.name.endswith('.sh'):
            assert member.mode == 0o755
            assert b'\r' not in archive.extractfile(member).read()
    count = len(archive.getmembers())
digest = hashlib.sha256(destination.read_bytes()).hexdigest()
destination.with_name(destination.name + '.sha256').write_text(digest + '  ' + destination.name + '\n', encoding='ascii')
print(f'{destination.name}: {count} archivos; {destination.stat().st_size / 1024:.1f} KiB; integridad y modos Unix OK.')
