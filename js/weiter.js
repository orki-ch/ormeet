// index.html -> index.php, Suchparameter und #/route bleiben erhalten (kein Inline-Skript wegen der CSP)
location.replace('index.php' + location.search + location.hash)
