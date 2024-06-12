import { canCompletionInStartTag } from "../../src/completion/pureUtils";
import chai from "chai";

const assert = chai.assert;

describe("canCompletionInStartTag()", () => {
    it("a", () => {
        const v = canCompletionInStartTag('<');
        assert.strictEqual(false, v);
    })
});