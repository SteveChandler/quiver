import { escapeHtml } from '@/lib/utils/html';

describe('escapeHtml', () => {
  it('escapes ampersand (&)', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeHtml('&&&&')).toBe('&amp;&amp;&amp;&amp;');
  });

  it('escapes less than (<)', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
  });

  it('escapes greater than (>)', () => {
    expect(escapeHtml('</script>')).toBe('&lt;/script&gt;');
    expect(escapeHtml('5 > 3')).toBe('5 &gt; 3');
  });

  it('escapes double quotes (")', () => {
    expect(escapeHtml('She said "hello"')).toBe('She said &quot;hello&quot;');
    expect(escapeHtml('class="test"')).toBe('class=&quot;test&quot;');
  });

  it("escapes single quotes (')", () => {
    expect(escapeHtml("It's working")).toBe('It&#39;s working');
    expect(escapeHtml("class='test'")).toBe('class=&#39;test&#39;');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns string unchanged when no special chars present', () => {
    const input = 'Hello World 123';
    expect(escapeHtml(input)).toBe(input);
  });

  it('escapes all special characters in combination', () => {
    const input = '<script>alert("XSS\' & \'attack")</script>';
    const expected =
      '&lt;script&gt;alert(&quot;XSS&#39; &amp; &#39;attack&quot;)&lt;/script&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('handles strings with only special characters', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('preserves whitespace and newlines', () => {
    const input = 'Line 1\nLine 2\tTabbed  Spaced';
    expect(escapeHtml(input)).toBe(input);
  });
});
