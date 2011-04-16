
test:
	@NODE_ENV=test ./support/expresso/bin/expresso \
		-I lib \
		-I support \
		-I support/connect/lib \
		-I support/jade/lib \
		test/index.js

.PHONY: test
