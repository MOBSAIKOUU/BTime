package btime;
import java.io.*;
import java.nio.file.*;
import java.util.zip.GZIPOutputStream;
/** Generate TNoodle's deterministic 4x4 lookup tables at build time. */
public final class ExportTables {
    public static void main(String[] args) throws Exception {
        Path target = Path.of(args[0]);
        Files.createDirectories(target.getParent());
        try (DataOutputStream output = new DataOutputStream(new BufferedOutputStream(
                new GZIPOutputStream(Files.newOutputStream(target))))) {
            cs.threephase.Tools.saveTo(output);
        }
        System.out.println("TNoodle 4x4 tables: " + Files.size(target) + " compressed bytes");
    }
}
