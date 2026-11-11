.PHONY: install dev dev-lan build preview preview-lan test browser webkit check format screenshots bench share-card clean
install:
	npm ci
dev:
	npm run dev
dev-lan:
	npm run dev:lan
build:
	npm run build
preview:
	npm run preview -- --port 5183 --strictPort
# Serves the build over HTTPS to other devices on the local network, such as a phone.
preview-lan:
	npm run preview:lan -- --port 5183 --strictPort
test:
	npm test
browser: build
	npx playwright test --project=chromium --project=phone
webkit: build
	npx playwright test --project=webkit
format:
	gofmt -w engine cmd
	npm run format
check:
	@files=$$(gofmt -l engine cmd); if [ -n "$$files" ]; then printf 'Run gofmt on:\n%s\n' "$$files"; exit 1; fi
	go vet ./...
	GOOS=js GOARCH=wasm go vet ./cmd/wasm
	npm run format:check
	npm test
	go test -race ./...
	npm run build
	npx playwright test
screenshots: build
	node scripts/screenshots.mjs work/screenshots
# Re-renders the committed link-preview card and touch icon from the build.
share-card: build
	npm run share-card
# Times terrain runs through the built WASM engine.
bench:
	npm run wasm
	node scripts/bench-terrain.mjs
clean:
	rm -rf dist public/engine.wasm public/wasm_exec.js public/GO-LICENSE public/THIRD-PARTY-NOTICES.txt
