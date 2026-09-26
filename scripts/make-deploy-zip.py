import zipfile
import os

files_to_zip = []
for root_target in ['dist', 'public']:
    for root, dirs, files in os.walk(root_target):
        for f in files:
            full_path = os.path.join(root, f)
            arc_name = os.path.relpath(full_path, '.').replace('\\', '/')
            files_to_zip.append((full_path, arc_name))

for single_file in ['package.json', 'package-lock.json']:
    if os.path.exists(single_file):
        files_to_zip.append((single_file, single_file))

with zipfile.ZipFile('deploy.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for full_path, arc_name in files_to_zip:
        z.write(full_path, arc_name)
        print(f'Added: {arc_name}')

print(f'Total {len(files_to_zip)} files zipped successfully with POSIX paths.')
