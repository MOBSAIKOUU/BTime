package btime;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import org.teavm.jso.typedarrays.Uint8Array;
import java.util.HashMap;
import java.util.Map;
import org.teavm.jso.JSExport;
import org.worldcubeassociation.tnoodle.scrambles.Puzzle;
import org.worldcubeassociation.tnoodle.puzzle.*;

/** Browser entry points for TNoodle-LIB 0.20.0. Run in a dedicated worker. */
public final class TNoodleBridge {
    private static final Map<String, Puzzle> puzzles = new HashMap<>();
    private static Puzzle puzzle(String event) {
        Puzzle existing = puzzles.get(event);
        if (existing != null) return existing;
        Puzzle created = switch (event) {
            case "222" -> new TwoByTwoCubePuzzle();
            case "333" -> new ThreeByThreeCubePuzzle();
            case "444" -> new FourByFourCubePuzzle();
            case "555" -> new CubePuzzle(5);
            case "666" -> new CubePuzzle(6);
            case "777" -> new CubePuzzle(7);
            case "clock" -> new ClockPuzzle();
            case "minx" -> new MegaminxPuzzle();
            case "pyram" -> new PyraminxPuzzle();
            case "skewb" -> new SkewbPuzzle();
            case "sq1" -> new SquareOnePuzzle();
            default -> throw new IllegalArgumentException("Unsupported event: " + event);
        };
        puzzles.put(event, created);
        return created;
    }
    @JSExport public static void loadFourByFourTables(Uint8Array input) throws IOException {
        byte[] bytes = new byte[input.getLength()];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) input.get(i);
        cs.threephase.Tools.initFrom(new DataInputStream(new ByteArrayInputStream(bytes)));
    }
    @JSExport public static String generateScramble(String event) {
        return puzzle(event).generateScramble();
    }
    @JSExport public static boolean isValidScramble(String event, String scramble) {
        try { return !puzzle(event).getSolvedState().applyAlgorithm(scramble).isSolved(); }
        catch (Exception error) { return false; }
    }
    public static void main(String[] args) {}
}
