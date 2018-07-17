start = tokens

tokens = hello:"Hello" "," " " world:"World" "!" {
  return hello + world;
}