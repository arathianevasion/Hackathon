import { describe, expect, it } from "vitest";
import { nestingErrors } from "./htmlNesting";

describe("nestingErrors", () => {
  it("passes valid markup, including void elements and React's text separators", () => {
    expect(
      nestingErrors('<main><div class="pg"><p>Hi <b>Rosa</b><!-- -->!</p><form><input type="hidden" name="t" value="1"><button>Go</button></form><br></div></main>'),
    ).toEqual([]);
  });

  it("flags a block element inside a <p>, which the browser would close early (#55)", () => {
    expect(nestingErrors("<p>Upload here: <form><button>link</button></form></p>")).toEqual(["<form> inside <p>"]);
    expect(nestingErrors("<p><div>x</div></p>")).toEqual(["<div> inside <p>"]);
  });

  it("flags nested forms, links and buttons", () => {
    expect(nestingErrors("<form><div><form></form></div></form>")).toEqual(["<form> inside <form>"]);
    expect(nestingErrors('<a href="/"><span><a href="/x">x</a></span></a>')).toEqual(["<a> inside <a>"]);
    expect(nestingErrors("<button><button>x</button></button>")).toEqual(["<button> inside <button>"]);
    expect(nestingErrors('<a href="/"><button>x</button></a>')).toEqual(["<button> inside <a>"]);
  });

  it("flags a heading inside a heading", () => {
    expect(nestingErrors("<h2><span><h3>x</h3></span></h2>")).toEqual(["<h3> inside <h2>"]);
  });

  it("flags table and list structure the browser would rewrite", () => {
    expect(nestingErrors("<table><tr><td>x</td></tr></table>")).toEqual(["<tr> inside <table>"]);
    expect(nestingErrors("<table><tbody><tr>x<td>y</td></tr></tbody></table>")).toEqual(["text inside <tr>"]);
    expect(nestingErrors("<div><li>x</li></div>")).toEqual(["<li> inside <div>"]);
  });
});
