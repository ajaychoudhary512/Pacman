import os
import sys
import subprocess

PACMAN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Pacman-Game-master", "Pacman")

if __name__ == '__main__':
    exit_code = subprocess.call([sys.executable, "pacman.py"] + sys.argv[1:], cwd=PACMAN_DIR)
    sys.exit(exit_code)
