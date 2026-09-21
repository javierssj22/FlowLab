"""Copy redistribution notices from the active build environment."""
import importlib.metadata
from pathlib import Path
import shutil
import sys
import sysconfig
import os

target = Path(sys.argv[1])
target.mkdir(parents=True, exist_ok=True)
version = f'{sys.version_info.major}.{sys.version_info.minor}'
candidates = [Path(sys.base_prefix) / 'LICENSE.txt',
              Path(sysconfig.get_path('stdlib')) / 'LICENSE.txt',
              Path('/usr/share/doc') / ('python' + version) / 'copyright',
              Path('/usr/share/doc') / ('python' + version + '-minimal') / 'copyright']
if os.environ.get('PYTHON_LICENSE_FILE'):
    candidates.insert(0, Path(os.environ['PYTHON_LICENSE_FILE']))
python_license = next((path for path in candidates if path.is_file()), None)
if python_license is None:
    raise RuntimeError('No se encuentra la licencia del runtime Python. Indica su archivo con PYTHON_LICENSE_FILE.')
shutil.copyfile(python_license, target / 'Python-LICENSE.txt')
for name in ('pyserial', 'pyinstaller', 'websockets'):
    dist = importlib.metadata.distribution(name)
    found = False
    for path in dist.files or []:
        if any(key in Path(path).name.lower() for key in ('license', 'copying')) and '.dist-info' in str(path):
            source = Path(dist.locate_file(path))
            if source.is_file():
                shutil.copyfile(source, target / (name + '-' + source.name))
                found = True
    shipped = Path(__file__).resolve().parent.parent / 'licenses' / (name + '-LICENSE.txt')
    if not found and shipped.is_file():
        shutil.copyfile(shipped, target / shipped.name)
        found = True
    if not found:
        raise RuntimeError('No se encontró el aviso de licencia de ' + name)
