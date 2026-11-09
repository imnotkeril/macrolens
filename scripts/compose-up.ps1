# Run Docker Compose with attestation disabled to avoid daemon EOF on some setups
$env:BUILDKIT_PROVENANCE = "0"
docker compose up --build @args
